import { SEO } from "@/components/SEO";
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
  ["Website", "Shows the product shape."],
  ["Request packet", "Scopes one site, task, and robot."],
  ["Robot validation", "Adds real rollouts when needed."],
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
              question: "Do generated clips prove robot success?",
              answer:
                "No. Generated clips are support media for review. Real-world validation requires evidence from the exact robot, task, and site envelope.",
            },
            {
              question: "What does a Policy Evaluation Run prove?",
              answer:
                "It ranks policies inside a scoped virtual evaluation. It does not approve deployment or safety.",
            },
          ]),
        ]}
      />

      <main className="bg-white text-slate-950">
        <section className="border-b border-slate-200">
          <div className="mx-auto grid max-w-[88rem] gap-10 px-5 py-12 md:grid-cols-[0.78fr_1.22fr] md:items-center md:px-8 md:py-16">
            <div>
              <h1 className="max-w-[10ch] text-5xl font-semibold leading-[0.95] tracking-normal sm:text-6xl">
                Proof stays scoped.
              </h1>
              <p className="mt-5 max-w-md text-lg leading-8 text-slate-600">
                Every claim belongs to one site, task, robot, and evidence set.
              </p>
              <a
                href={requestHref}
                className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Start
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
            <img
              src={wamPolicyEvalAssets.rolloutStrip}
              alt="Generated rollout support frames for a humanoid robot task"
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

        <section className="border-y border-slate-200 bg-slate-950 text-white">
          <div className="mx-auto grid max-w-[88rem] gap-6 px-5 py-10 md:grid-cols-[auto_1fr] md:items-start md:px-8">
            <ShieldCheck className="h-10 w-10 text-blue-300" aria-hidden="true" />
            <div>
              <h2 className="text-3xl font-semibold">What we do not claim.</h2>
              <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300">
                Virtual evaluations do not approve deployment, safety, universal
                SRCC, or guaranteed real-world success. Validated packs report
                metrics only inside the matched robot, task, and site envelope.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
