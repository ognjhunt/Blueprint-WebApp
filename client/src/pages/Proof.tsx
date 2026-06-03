import { SEO } from "@/components/SEO";
import { humanoidReadinessAssets } from "@/lib/editorialGeneratedAssets";
import {
  ArrowRight,
  ClipboardCheck,
  FileText,
  Fingerprint,
  LockKeyhole,
  PackageCheck,
  Route,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ProofItem = {
  icon: LucideIcon;
  label: string;
  title: string;
  body: string;
};

const requestHref =
  "/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=proof-packet&source=proof-kiss";

const sampleVsRequest = [
  {
    label: "Public sample",
    sample: "Illustrative proof board, sample manifest, sample rights posture, and sample report shape.",
    request: "Capture record, task scope, robot profile, thresholds, rights/privacy posture, and proof gaps for one site.",
  },
  {
    label: "Generated or model-derived output",
    sample: "Useful support signal when labeled as generated, inferred, or representative.",
    request: "Owner-system evidence such as provider artifacts, runtime records, simulator traces, action logs, robot trials, and safety review.",
  },
  {
    label: "Readiness recommendation",
    sample: "Shows how Blueprint frames proceed, modify site, gather more data, compare vendors, or hold.",
    request: "A request-scoped advisory tied to the exact facility, task, pass bar, package state, and missing-proof labels.",
  },
];

const hierarchy: ProofItem[] = [
  {
    icon: Fingerprint,
    label: "01",
    title: "Capture provenance",
    body: "Raw capture evidence, route context, timestamps, poses, device metadata, freshness, and source identifiers.",
  },
  {
    icon: LockKeyhole,
    label: "02",
    title: "Rights and privacy posture",
    body: "Use limits, restricted zones, redaction needs, sharing scope, export limits, and commercialization boundaries.",
  },
  {
    icon: PackageCheck,
    label: "03",
    title: "Site package contract",
    body: "Manifest, included files, geometry where available, proof depth, hosted-review limits, and package access state.",
  },
  {
    icon: ClipboardCheck,
    label: "04",
    title: "Readiness advisory",
    body: "Task thresholds, failure modes, site modifications, data needs, unresolved proof, and next-step recommendation.",
  },
];

const decisions = [
  "Proceed to a short-pilot protocol",
  "Modify the site before pilot time",
  "Gather simulator traces, action logs, or robot-trial evidence",
  "Compare vendors against the same task and threshold set",
  "Hold until the proof gap is resolved",
];

export default function Proof() {
  return (
    <>
      <SEO
        title="Proof | Blueprint"
        description="A short Blueprint proof explainer separating public samples from request-specific robot deployment readiness evidence."
        canonical="/proof"
        image={`https://tryblueprint.io${humanoidReadinessAssets.proofBoard}`}
      />

      <div className="bg-[#f6f1e8] text-[#111110]">
        <section className="relative overflow-hidden bg-[#111110] px-4 py-20 text-white sm:px-6 lg:px-10">
          <img
            src={humanoidReadinessAssets.proofBoard}
            alt="Illustrative proof board for robot readiness evidence"
            className="absolute inset-0 h-full w-full object-cover opacity-36"
          />
          <div className="absolute inset-0 bg-black/68" />
          <div className="relative mx-auto max-w-[88rem]">
            <p className="text-sm font-semibold uppercase tracking-normal text-[#d8bd8d]">
              Proof
            </p>
            <h1 className="mt-4 max-w-4xl text-5xl font-semibold leading-none md:text-7xl">
              See what supports the readiness estimate.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/78">
              Blueprint proof keeps the buyer question grounded: what came from
              capture, what is inferred, what is still missing, and what claim
              the evidence can actually support.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={requestHref}
                className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#d8bd8d] px-5 text-sm font-semibold text-[#111110] transition hover:bg-[#e8cfa1]"
              >
                Request readiness review
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href="/pricing"
                className="inline-flex min-h-12 items-center justify-center border border-white/30 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                See pricing
              </a>
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-[88rem]">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-normal text-[#8b6f42]">
                Sample vs request
              </p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight">
                The public packet teaches the workflow. The request packet proves one site.
              </h2>
            </div>
            <div className="mt-8 overflow-hidden border border-black/10 bg-white">
              <div className="grid bg-[#111110] text-sm font-semibold uppercase tracking-normal text-white sm:grid-cols-[0.24fr_0.38fr_0.38fr]">
                <div className="border-b border-white/15 p-4 sm:border-b-0 sm:border-r">Layer</div>
                <div className="border-b border-white/15 p-4 sm:border-b-0 sm:border-r">Public sample</div>
                <div className="p-4">Request-specific proof</div>
              </div>
              {sampleVsRequest.map((row) => (
                <div
                  key={row.label}
                  className="grid border-t border-black/10 text-sm leading-6 sm:grid-cols-[0.24fr_0.38fr_0.38fr]"
                >
                  <div className="bg-[#f8f4ec] p-4 font-semibold">{row.label}</div>
                  <div className="border-t border-black/10 p-4 text-[#5f5a53] sm:border-l sm:border-t-0">
                    {row.sample}
                  </div>
                  <div className="border-t border-black/10 p-4 text-[#5f5a53] sm:border-l sm:border-t-0">
                    {row.request}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-black/10 bg-white px-4 py-14 sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-[88rem] gap-8 lg:grid-cols-[0.34fr_0.66fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-[#8b6f42]">
                Evidence hierarchy
              </p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight">
                Every output should point back to the source packet.
              </h2>
              <p className="mt-4 text-base leading-7 text-[#5f5a53]">
                Repo tests and samples can prove public wording. They do not
                prove operational robot readiness.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {hierarchy.map((item) => {
                const Icon = item.icon;

                return (
                  <article key={item.title} className="border border-black/10 bg-[#f8f4ec] p-5">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs font-semibold uppercase tracking-normal text-[#8b6f42]">
                        {item.label}
                      </span>
                      <Icon className="h-5 w-5 text-[#111110]" aria-hidden="true" />
                    </div>
                    <h3 className="mt-5 text-xl font-semibold">{item.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-[#5f5a53]">{item.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-[88rem] gap-8 lg:grid-cols-[0.46fr_0.54fr]">
            <div className="border border-black/10 bg-white p-6">
              <FileText className="h-8 w-8 text-[#8b6f42]" aria-hidden="true" />
              <h2 className="mt-5 text-3xl font-semibold leading-tight">
                A proof packet should make the readiness decision obvious.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#5f5a53]">
                The buyer should be able to see why Blueprint recommends a short
                pilot, site modification, more data, vendor comparison, or hold.
              </p>
            </div>
            <div className="grid gap-3">
              {decisions.map((decision) => (
                <div key={decision} className="flex gap-3 border border-black/10 bg-white p-4">
                  <Route className="mt-1 h-5 w-5 flex-none text-[#8b6f42]" aria-hidden="true" />
                  <p className="text-sm font-semibold leading-6">{decision}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-14 sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-[88rem] gap-6 border border-black/10 bg-[#111110] p-6 text-white md:grid-cols-[0.2fr_0.8fr] md:p-8">
            <ShieldCheck className="h-10 w-10 text-[#d8bd8d]" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-[#d8bd8d]">
                Claim boundary
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                Advisory until stronger proof exists.
              </h2>
              <p className="mt-4 max-w-4xl text-sm leading-7 text-white/74">
                Blueprint can publish polished proof structure, sample packets,
                and request paths. It must not claim safety validation,
                simulator execution completed, robot-trial success, cleared
                rights, hosted-session fulfillment, payment success, or ready to
                deploy unless the owning systems prove those facts for the
                request.
              </p>
              <a
                href={requestHref}
                className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 bg-[#d8bd8d] px-4 text-sm font-semibold text-[#111110] transition hover:bg-[#e8cfa1]"
              >
                Request a proof packet
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
