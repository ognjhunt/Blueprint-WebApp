import { SEO } from "@/components/SEO";
import { ArrowRight, Mail } from "lucide-react";
import {
  companyTrustItems,
  hostedEvaluationDefinition,
  sitePackageDefinition,
  worldModelDefinition,
} from "@/data/marketingDefinitions";

const marketSignals = [
  {
    value: "$675M",
    label: "raised by California-based Figure in one 2024 round",
    sourceLabel: "Axios on Figure",
    sourceHref:
      "https://www.axios.com/newsletters/axios-what%27s-next-94d3189a-6870-497a-81ce-f70d06f2f4d1",
  },
  {
    value: "$350M",
    label: "raised by Texas-based Apptronik in 2025",
    sourceLabel: "Axios on Apptronik",
    sourceHref: "https://www.axios.com/2025/02/13/apptronik-350-millionhumanoid-robots",
  },
  {
    value: "37,587",
    label: "industrial robots installed in U.S. factories in 2023",
    sourceLabel: "IFR on the U.S. market",
    sourceHref: "https://ifr.org/downloads/press2018/2024-SEP-24_IFR_press_release_World_Robotics_2024_-_USA.pdf",
  },
];

const companyFacts = [
  {
    title: "What Blueprint sells",
    body:
      "Blueprint sells site-specific world models, site packages, and hosted evaluation built from real indoor capture.",
  },
  {
    title: "Who it is for",
    body:
      "Robot teams preparing for a pilot, field visit, or deployment question that depends on one exact facility.",
  },
  {
    title: "What it does not claim",
    body:
      "Blueprint does not claim that one package or one hosted session replaces final on-site validation, safety review, or deployment signoff.",
  },
];

const deploymentStory = [
  "In the U.S., robotics is clearly not short on capital. The funding headlines are real. What is still harder is turning that capital into repeatable deployments on real sites.",
  "There is no single public database for 'successful robot deployments per year' across every U.S. robotics category. The cleanest public proxy is actual installation data. That misses plenty of service-robot activity, but it is still better than pretending the deployment number is easy to measure.",
  "Blueprint exists to push that deployment number up year after year by getting the real site in front of the team earlier, packaging it clearly, and making evaluation less blind before the fieldwork starts.",
];

const references = [
  { label: "Company LinkedIn", href: "https://www.linkedin.com/company/blueprintsim/" },
  { label: "Governance", href: "/governance" },
  { label: "Compatibility & exports", href: "/docs" },
];

export default function About() {
  return (
    <>
      <SEO
        title="About | Blueprint"
        description="What Blueprint is, what it sells, and how it handles world-model packages, hosted evaluation, and trust metadata."
        canonical="/about"
      />
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                About Blueprint
              </p>
              <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                Blueprint exists to help robotics capital turn into real deployments.
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-600">
                The industry has raised enormous amounts of money and produced real progress, but
                deployment still breaks on the same things over and over: unknown sites, late
                context, messy handoffs, and too much fieldwork before the team has grounded the
                actual environment.
              </p>
              <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <p className="text-sm leading-7 text-slate-700">{worldModelDefinition}</p>
                <p className="text-sm leading-7 text-slate-700">{sitePackageDefinition}</p>
                <p className="text-sm leading-7 text-slate-700">{hostedEvaluationDefinition}</p>
              </div>
            </div>

            <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-slate-900">Trust posture</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                {companyTrustItems.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-900">Company references</p>
                <div className="mt-4 flex flex-col gap-3">
                  {references.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="text-sm font-semibold text-slate-900 transition hover:text-slate-700"
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/contact?persona=robot-team"
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Contact Blueprint
                </a>
                <a
                  href="mailto:hello@tryblueprint.io"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  <Mail className="h-4 w-4" />
                  hello@tryblueprint.io
                </a>
              </div>
            </aside>
          </div>

          <section className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              The gap
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              In the U.S., capital is not the bottleneck anymore. Deployment is.
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {marketSignals.map((item) => (
                <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-3xl font-bold tracking-tight text-slate-900">{item.value}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.label}</p>
                  <a
                    href={item.sourceHref}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex text-sm font-semibold text-slate-900 transition hover:text-slate-700"
                  >
                    {item.sourceLabel}
                  </a>
                </article>
              ))}
            </div>
            <div className="mt-8 max-w-4xl space-y-4 text-sm leading-7 text-slate-700">
              {deploymentStory.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {companyFacts.map((item) => (
              <section key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-2xl font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              </section>
            ))}
          </div>

          <section className="mt-12 rounded-2xl bg-slate-950 p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Our goal is to make real robot deployments increase year after year by cutting the
              cost, delay, and guesswork between interest and real-site validation.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              That starts with a simple rule: get the actual site in front of the team earlier.
              Then make the package, the hosted runtime, and the trust boundaries clear enough that
              the team can move from curiosity to real deployment work without flying blind.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a
                href="/world-models"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Explore world models
              </a>
              <a
                href="/contact?persona=robot-team"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
              >
                Contact Blueprint
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
