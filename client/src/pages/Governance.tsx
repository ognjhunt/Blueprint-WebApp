import { ShieldCheck } from "lucide-react";

import { SEO } from "@/components/SEO";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

import {
  Card,
  DataField,
  Eyebrow,
  ProofBoundary,
  StatusChip,
} from "@/components/blueprint";
import {
  EditorialSectionIntro,
  ProofChip,
} from "@/components/site/editorial";
import {
  robotPolicyBeachheadShort,
  robotPolicyEvaluationBoundary,
} from "@/data/robotPolicyEvaluationClaims";

const gates = [
  {
    tone: "proof" as const,
    chip: "Rights",
    title: "Rights",
    body:
      "Rights class, export entitlements, and sharing limits are attached to the listing and manifest — not inferred from copy. A buyer reads what is licensed before access.",
  },
  {
    tone: "info" as const,
    chip: "Privacy",
    title: "Privacy",
    body:
      "Records identify whether privacy processing ran, whether raw media is retained, and what stays visible or exportable. Restricted, private, and employee-only areas are out of scope by default.",
  },
  {
    tone: "neutral" as const,
    chip: "Provenance",
    title: "Provenance",
    body:
      "Facility identifier, capture timing, freshness state, approval path, and proof depth travel with the capture and its listing so a site is treated as current only when it actually is. World models, when present, are internal generation and review support — never the proof or the product.",
  },
  {
    tone: "warn" as const,
    chip: "Scope limits",
    title: "Scope limits",
    body:
      "Hosted sessions separate what is launchable, what stays human-gated, and which outputs are examples versus confirmed exports. Generated media is labeled review support.",
  },
];

const rightsPacket: Array<{ label: string; value: string; mono?: boolean }> = [
  { label: "Packet ID", value: "RIGHTS-2049-08" },
  { label: "Facility", value: "SITE-2049 · Midwest DC" },
  { label: "Eval envelope", value: "Nav + rigid pick-and-place · dexterous out of scope" },
  { label: "Rights class", value: "Evaluation now · licensed export later (Data Package)" },
  { label: "Export scope", value: "Buyer + 1 named policy team" },
  { label: "Restricted zones", value: "Checkout · employee corridor" },
  { label: "Retention", value: "Raw 90d · derived 365d", mono: true },
  { label: "Approval path", value: "Operator → Blueprint review" },
  { label: "Revocation", value: "Takedown honored ≤ 5 business days" },
];

const guarantees = [
  "Our Task Evaluation Run ranks robot policies on a captured real-site task envelope — an estimate and decision-support ranking to screen before field time, never a guarantee, safety certification, or deployment readiness.",
  "We show proof depth, freshness, and commercial status on every listing before access.",
  "We keep rights, restricted zones, and export scope attached to the manifest, not the marketing.",
  "We separate public proof from example UI in every hosted-access surface.",
  "We label generated and simulated media as review support, never as real-world proof.",
  "We frame policy comparison as rank fidelity and predicted success — never a deployment guarantee.",
  "We honor takedown, refresh, redaction, and revocation requests on the published timeline.",
];

export default function Governance() {
  return (
    <>
      <SEO
        title="Governance | Blueprint"
        description="Blueprint's trust page: rights, privacy, and provenance kept visible across every listing, manifest, and hosted-access surface."
        canonical="/governance"
        jsonLd={[
          webPageJsonLd({
            path: "/governance",
            name: "Blueprint Governance",
            description:
              "Rights, privacy, and provenance kept visible across every Blueprint listing, manifest, and hosted-access surface.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Governance", path: "/governance" },
          ]),
        ]}
      />

      <div className="bg-canvas text-ink">
        {/* Hero — dark #0d0d0b + evidence grid */}
        <section className="relative overflow-hidden border-b border-line bg-ink">
          <div
            aria-hidden="true"
            className="bp-evidence-grid pointer-events-none absolute inset-0 opacity-60"
          />
          <div className="relative mx-auto max-w-[88rem] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
            <div className="max-w-[44rem]">
              <Eyebrow tone="onInk" rule>
                Governance
              </Eyebrow>
              <h1 className="font-editorial mt-6 text-[clamp(2.4rem,4.6vw,4rem)] font-medium leading-[0.98] tracking-[-0.045em] text-[color:var(--text-on-ink)]">
                Rights, privacy, and provenance — kept visible.
              </h1>
              <p className="mt-6 max-w-[36rem] text-lg leading-[1.7] text-[color:var(--text-on-ink)] opacity-75">
                Blueprint sells one thing to robot and foundation-model teams: a
                site-specific Task Evaluation Run that ranks their policies on a captured
                real-site task envelope. This page is how that ranking&rsquo;s rights, privacy,
                and provenance stay provable. Every Blueprint capture is built from a real
                place, with readable proof of where, when, how, and under what rights it was
                captured. The trust details are product surfaces, not promises.
              </p>
              <p className="mt-5 max-w-[36rem] font-mono text-[12px] leading-[1.6] text-[color:var(--text-on-ink)] opacity-70">
                Eval envelope: {robotPolicyBeachheadShort} · dexterous, contact-rich
                manipulation out of scope for now.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                <ProofChip light>Rights stay explicit</ProofChip>
                <ProofChip light>Hosted access stays bounded</ProofChip>
                <ProofChip light>No claims beyond the listing</ProofChip>
              </div>
            </div>
          </div>
        </section>

        {/* Four gates — TileGrid cols 4 */}
        <section className="mx-auto max-w-[88rem] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
          <EditorialSectionIntro
            eyebrow="Four gates"
            title="Every evaluation run passes the same four gates."
            description="Each gate is a readable record a buyer can check before they treat a site as usable."
            className="max-w-3xl"
          />
          <div className="mt-8 grid gap-px overflow-hidden rounded-md border border-line bg-[#ded7c8] sm:grid-cols-2 lg:grid-cols-4">
            {gates.map((gate) => (
              <div key={gate.title} className="flex h-full flex-col gap-5 bg-white p-6">
                <StatusChip tone={gate.tone} square>
                  {gate.chip}
                </StatusChip>
                <div>
                  <h3 className="text-title-m font-semibold tracking-tight text-ink">
                    {gate.title}
                  </h3>
                  <p className="mt-3 text-[14px] leading-[1.65] text-ink-500">{gate.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Rights packet example + What we guarantee */}
        <section className="border-y border-line bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-4 px-5 py-12 sm:px-8 lg:grid-cols-[0.5fr_0.5fr] lg:px-10 lg:py-16">
            <Card
              tone="inset"
              eyebrow="Rights packet · example"
              title="What stays attached to a listing"
              headerRight={
                <StatusChip tone="proof" square>
                  Illustrative
                </StatusChip>
              }
            >
              <div className="divide-y divide-line-soft">
                {rightsPacket.map((row) => (
                  <DataField
                    key={row.label}
                    label={row.label}
                    value={row.value}
                    mono={row.mono ?? true}
                    border={false}
                  />
                ))}
              </div>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-400">
                Illustrative values · not a live record
              </p>
            </Card>

            <div className="flex flex-col">
              <Eyebrow tone="muted" rule>
                What we guarantee
              </Eyebrow>
              <h2 className="font-editorial mt-5 text-[clamp(1.8rem,2.8vw,2.6rem)] font-medium leading-[1.04] tracking-[-0.035em] text-ink">
                Seven commitments we hold on every evaluation run.
              </h2>
              <div className="mt-7 divide-y divide-line-soft border-t border-line-soft">
                {guarantees.map((item) => (
                  <div key={item} className="flex gap-3 py-4">
                    <ShieldCheck
                      className="mt-0.5 h-[1.05rem] w-[1.05rem] shrink-0 text-proof-fg"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <p className="text-[15px] leading-[1.6] text-ink-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Hard limit — block ProofBoundary */}
        <section className="mx-auto max-w-[88rem] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
          <EditorialSectionIntro
            eyebrow="Hard limit"
            title="The line we will not cross."
            description={robotPolicyEvaluationBoundary}
            className="max-w-3xl"
          />
          <div className="mt-8 max-w-3xl">
            <ProofBoundary level="block" title="No capture of restricted or private areas">
              Blueprint does not capture, list, or commercialize restricted, private, or
              employee-only areas without explicit operator approval, and it does not claim
              deployment readiness, safety certification, or guaranteed outcomes. If a
              listing cannot prove its rights and provenance, it does not ship.
            </ProofBoundary>
          </div>
        </section>
      </div>
    </>
  );
}
