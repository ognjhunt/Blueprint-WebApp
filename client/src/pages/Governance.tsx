import { ShieldCheck } from "lucide-react";

import { SEO } from "@/components/SEO";
import { DataField, ProofBoundary, StatusChip } from "@/components/blueprint";
import { ControlBoundaryFigure, FigureFrame } from "@/components/site/figures";
import { Reveal, Stagger } from "@/components/site/motion";
import {
  Accent,
  BigCta,
  MonoNote,
  Section,
  SectionHead,
} from "@/components/site/publicSections";
import {
  robotPolicyBeachheadShort,
  robotPolicyEvaluationBoundary,
} from "@/data/robotPolicyEvaluationClaims";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const gates = [
  {
    tone: "proof" as const,
    chip: "Rights",
    title: "Rights",
    body:
      "Rights class, export entitlements, and sharing limits are attached to the capture record and manifest — never inferred from copy. What is licensed is readable before anyone gets access.",
  },
  {
    tone: "info" as const,
    chip: "Privacy",
    title: "Privacy",
    body:
      "Records state whether privacy processing ran, whether raw media is retained, and what stays visible or exportable. Restricted, private, and employee-only areas are out of scope by default.",
  },
  {
    tone: "neutral" as const,
    chip: "Provenance",
    title: "Provenance",
    body:
      "Facility identifier, capture timing, freshness, approval path, and evidence depth travel with the testbed, so a site counts as current only when it actually is. Generated and simulated material is internal support, never the proof.",
  },
  {
    tone: "warn" as const,
    chip: "Scope limits",
    title: "Scope limits",
    body:
      "Hosted review separates what can be launched, what stays human-gated, and which outputs are labelled examples rather than confirmed exports.",
  },
];

const rightsPacket: Array<{ label: string; value: string; mono?: boolean }> = [
  { label: "Packet ID", value: "RIGHTS-2049-08" },
  { label: "Facility", value: "SITE-2049 · Midwest DC" },
  { label: "Eval envelope", value: "Nav + rigid pick-and-place · dexterous out of scope" },
  { label: "Rights class", value: "Evaluation now · licensed evidence export only when eligible" },
  { label: "Export scope", value: "Buyer + 1 named policy team" },
  { label: "Restricted zones", value: "Checkout · employee corridor" },
  { label: "Retention", value: "Raw 90d · derived 365d", mono: true },
  { label: "Approval path", value: "Operator → Blueprint review" },
  { label: "Revocation", value: "Takedown honored ≤ 5 business days" },
];

const guarantees = [
  "Evidence depth, freshness, and commercial status are shown before access, not after.",
  "Rights, restricted zones, and export scope stay attached to the manifest, not the marketing.",
  "Public proof and example UI are separated on every hosted-access surface.",
  "Generated and simulated media is labelled review support, never real-world proof.",
  "Only the per-claim outcome the run envelope supports is reported — never a deployment guarantee.",
  "Takedown, refresh, redaction, and revocation requests are honored on the published timeline.",
];

export default function Governance() {
  return (
    <>
      <SEO
        title="Governance | Blueprint"
        description="Blueprint's trust page: rights, privacy, and provenance kept visible across every capture, manifest, and hosted-access surface."
        canonical="/governance"
        jsonLd={[
          webPageJsonLd({
            path: "/governance",
            name: "Blueprint Governance",
            description:
              "Rights, privacy, and provenance kept visible across every Blueprint capture, manifest, and hosted-access surface.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Governance", path: "/governance" },
          ]),
        ]}
      />

      {/* ---------------------------------------------------------- hero ---- */}
      <section className="relative isolate overflow-hidden bg-ink">
        <div aria-hidden className="bp-evidence-grid absolute inset-0 opacity-[0.35]" />
        <div className="relative mx-auto max-w-[88rem] px-5 pb-16 pt-16 sm:px-8 lg:px-10 lg:pb-20 lg:pt-24">
          <Reveal y="1.75rem" className="max-w-[48rem]">
            <div className="flex items-center gap-4">
              <span aria-hidden className="h-px w-10 bg-brass/70" />
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-brass">
                Governance
              </span>
            </div>
            <h1 className="mt-7 font-display text-[clamp(2.4rem,5vw,4.5rem)] font-medium leading-[0.99] tracking-[-0.045em] text-[color:var(--text-on-ink)]">
              Rights, privacy, and provenance — kept visible.
            </h1>
            <p className="mt-7 max-w-[38rem] text-[1.0625rem] leading-[1.75] text-white/70">
              Blueprint sells one service: a Task Evaluation Run against a captured real site-task.
              This page is how that run's rights, privacy, and provenance stay checkable. Every
              testbed is built from a real place with readable proof of where, when, how, and under
              what rights it was captured — as product surfaces, not promises.
            </p>
            <p className="mt-5 max-w-[38rem] font-mono text-[11.5px] leading-[1.7] text-white/50">
              Eval envelope: {robotPolicyBeachheadShort} · dexterous, contact-rich manipulation out
              of scope for now.
            </p>
            <ul className="mt-9 flex flex-wrap gap-x-7 gap-y-3">
              {["Rights stay explicit", "Hosted access stays bounded", "No claims beyond the record"].map((chip) => (
                <li
                  key={chip}
                  className="inline-flex items-center gap-2.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-white/55"
                >
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brass" />
                  {chip}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* --------------------------------------------------------- control ---- */}
      <Section tone="canvas">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHead
              index="01"
              eyebrow="The boundary"
              title={
                <>
                  A hard line between <Accent>what you decide</Accent> and what we owe you.
                </>
              }
              lede="Access, redaction, and permitted evidence use are recorded per site and per run, not assumed. Nothing crosses this line implicitly — and safety approval never crosses it at all."
            />
            <div className="mt-8">
              <MonoNote label="Default posture">
                Restricted, private, and employee-only areas are out of scope unless the operator
                explicitly approves them.
              </MonoNote>
            </div>
          </div>

          <FigureFrame
            eyebrow="Figure 01 — Control boundary"
            title="Who holds which decision"
            kind="schematic"
            note="Schematic of the accountability split recorded per site and per run. Individual restrictions live in your own rights record."
          >
            <ControlBoundaryFigure />
          </FigureFrame>
        </div>
      </Section>

      {/* ----------------------------------------------------------- gates ---- */}
      <Section tone="paper">
        <SectionHead
          index="02"
          eyebrow="Four gates"
          title={
            <>
              Every capture passes <Accent>the same four gates</Accent>.
            </>
          }
          lede="Each gate is a readable record you can check before treating a site as usable."
          align="wide"
        />
        <Stagger className="mt-12 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4" step={80}>
          {gates.map((gate) => (
            <div key={gate.title} className="flex h-full flex-col gap-5 bg-white p-6">
              <StatusChip tone={gate.tone} square>
                {gate.chip}
              </StatusChip>
              <div>
                <h3 className="font-display text-[1.375rem] font-medium tracking-[-0.02em] text-ink-900">
                  {gate.title}
                </h3>
                <p className="mt-3 text-[13.5px] leading-[1.7] text-ink-500">{gate.body}</p>
              </div>
            </div>
          ))}
        </Stagger>
      </Section>

      {/* --------------------------------------------------------- packet ---- */}
      <Section tone="white">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
          <Reveal>
            <div className="border border-line bg-canvas">
              <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-brass-deep">
                  Rights packet · example
                </p>
                <StatusChip tone="proof" square>
                  Illustrative
                </StatusChip>
              </div>
              <div className="divide-y divide-line-soft px-5 py-3">
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
              <p className="border-t border-line px-5 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400">
                Illustrative values · not a live record
              </p>
            </div>
          </Reveal>

          <Reveal delay={110}>
            <SectionHead
              index="03"
              eyebrow="What we commit to"
              title={
                <>
                  Six commitments that hold <Accent>on every capture</Accent>.
                </>
              }
            />
            <div className="mt-8 divide-y divide-line-soft border-t border-line-soft">
              {guarantees.map((item) => (
                <div key={item} className="flex gap-3 py-4">
                  <ShieldCheck
                    className="mt-0.5 h-[1.05rem] w-[1.05rem] shrink-0 text-proof-fg"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <p className="text-[14.5px] leading-[1.7] text-ink-700">{item}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ----------------------------------------------------------- limit ---- */}
      <Section tone="canvas">
        <SectionHead
          index="04"
          eyebrow="Hard limit"
          title={
            <>
              The line we <Accent>will not cross</Accent>.
            </>
          }
          lede={robotPolicyEvaluationBoundary}
          align="wide"
        />
        <Reveal className="mt-10 max-w-4xl">
          <ProofBoundary level="block" title="No capture of restricted or private areas">
            Blueprint does not capture, list, or commercialize restricted, private, or employee-only
            areas without explicit operator approval, and it does not claim deployment readiness,
            safety certification, or guaranteed outcomes. If a capture cannot prove its rights and
            provenance, it does not ship.
          </ProofBoundary>
        </Reveal>
      </Section>

      <BigCta
        eyebrow="For site operators"
        title={
          <>
            Set the boundaries first. <br className="hidden sm:block" />
            Then let the evidence do its work.
          </>
        }
        body="Tell us the workflow, the windows we may capture in, the areas that stay off limits, and what evidence use you permit. The run is scoped inside those limits, not around them."
        imageSrc="/redesign/pov/retail-backroom.jpg"
        imageAlt="Retail backroom aisle with restricted areas marked out"
        primaryHref="/contact/site-operator?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=governance"
        primaryLabel="Request a Task Evaluation Run"
        secondaryHref="/for-site-operators"
        secondaryLabel="Site-operator use case"
      />
    </>
  );
}
