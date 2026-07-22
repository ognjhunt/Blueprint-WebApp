import { SEO } from "@/components/SEO";
import {
  robotPolicyEvaluationBeachhead,
  robotPolicyEvaluationBoundary,
  robotPolicyResearchSignals,
  robotPolicyScreeningValue,
} from "@/data/robotPolicyEvaluationClaims";
import { wamPolicyEvalAssets } from "@/lib/editorialGeneratedAssets";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  webPageJsonLd,
} from "@/lib/seoStructuredData";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";

const requestHref =
  "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&source=proof";

const proofLayers = [
  ["Captured real-site envelope", "Scopes one captured site, task, robot, policy set, and threshold — the capture-backed evidence a run ranks against."],
  ["Owner proof", "Adds simulator traces, action logs, or real rollouts when needed."],
  ["Research signal", "A secondary, follow-on support layer: generated-observation review can back policy comparisons."],
];

export default function Proof() {
  return (
    <>
      <SEO
        title="Proof | Blueprint"
        description="Blueprint keeps policy evaluation claims scoped to the site, task, robot, and evidence behind each run."
        canonical="/proof"
        image={`https://tryblueprint.io${wamPolicyEvalAssets.rolloutStrip}`}
        jsonLd={[
          webPageJsonLd({
            path: "/proof",
            name: "Blueprint proof boundaries",
            description:
              "Explains public samples, request packets, and real robot validation boundaries.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Proof", path: "/proof" },
          ]),
          faqJsonLd([
            {
              question: "Does the 0.929 result mean Blueprint claims 93% external accuracy?",
              answer:
                "No. SC3-Eval reports a 0.929 closed-loop Pearson correlation across seven VLA policies. Blueprint cites it as research evidence for ranking workflows, not as an external accuracy guarantee.",
            },
            {
              question: "What does a Policy Evaluation Run return?",
              answer:
                "It returns a capture-backed evaluation artifact for one scoped site, task, robot, and threshold envelope. Any simulator-backed policy-ranking result stays advisory until request-scoped owner-system proof is attached and reported.",
            },
          ]),
        ]}
      />

      <div className="bg-white text-slate-950">
        <section className="border-b border-slate-200">
          <div className="mx-auto grid max-w-[88rem] gap-10 px-5 py-12 md:grid-cols-[0.78fr_1.22fr] md:items-center md:px-8 md:py-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                {robotPolicyEvaluationBeachhead}
              </p>
              <h1 className="mt-4 max-w-[16ch] text-5xl font-semibold leading-[0.95] tracking-normal sm:text-6xl">
                Proof for the decision.
              </h1>
              <p className="mt-5 max-w-md text-lg leading-8 text-slate-600">
                {robotPolicyScreeningValue}
              </p>
              <p className="mt-4 max-w-md text-sm leading-7 text-slate-500">
                SC3-Eval's published 0.929 correlation is third-party research
                context, not a Blueprint result, accuracy claim, or deployment claim.
              </p>
              <a
                href={requestHref}
                className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Request evaluation
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
            <img
              src={wamPolicyEvalAssets.rolloutStrip}
              alt="Generated preview / review support: rollout frames of a mobile robot navigating a warehouse aisle and making a rigid tote pick"
              className="aspect-[16/6] w-full rounded-lg border border-slate-200 object-cover"
            />
          </div>
        </section>

        <section className="mx-auto grid max-w-[88rem] gap-4 px-5 py-10 md:grid-cols-3 md:px-8">
          {proofLayers.map(([title, body]) => (
            <article key={title} className="rounded-lg border border-slate-200 bg-white p-6">
              <CheckCircle2 className="h-5 w-5 text-blue-600" aria-hidden="true" />
              <h2 className="mt-5 text-3xl font-semibold">{title}</h2>
              <p className="mt-3 text-base leading-7 text-slate-600">{body}</p>
            </article>
          ))}
        </section>

        <section className="border-y border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-[88rem] gap-4 px-5 py-10 md:grid-cols-[0.34fr_0.66fr] md:px-8">
            <div>
              <h2 className="text-3xl font-semibold">What we cite.</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                These papers support the category: generated or virtual policy
                rollouts can be useful for comparing policies and diagnosing
                failures. Blueprint still requires request-scoped evidence for
                stronger operational claims.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {robotPolicyResearchSignals.map((signal) => (
                <a
                  key={signal.label}
                  href={signal.href}
                  className="rounded-lg border border-slate-200 bg-white p-5 hover:bg-slate-50"
                >
                  <h3 className="text-xl font-semibold">{signal.label}</h3>
                  <p className="mt-3 text-sm font-semibold text-blue-700">{signal.stat}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{signal.body}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-950 text-white">
          <div className="mx-auto grid max-w-[88rem] gap-6 px-5 py-10 md:grid-cols-[auto_1fr] md:items-start md:px-8">
            <ShieldCheck className="h-10 w-10 text-blue-300" aria-hidden="true" />
            <div>
              <h2 className="text-3xl font-semibold">What we do not claim.</h2>
              <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300">
                {robotPolicyEvaluationBoundary} Provenance-checked packs report metrics
                only inside the matched robot, task, and site envelope.
              </p>
              <p className="mt-4 max-w-4xl text-sm font-semibold leading-7 text-slate-200">
                A Task Evaluation Run returns a ranking / estimate — not a guarantee or
                safety certification.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
