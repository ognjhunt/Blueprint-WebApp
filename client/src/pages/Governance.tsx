import { ShieldCheck } from "lucide-react";

import { SEO } from "@/components/SEO";
import { DataField, ProofBoundary, StatusChip } from "@/components/blueprint";
import { Figure } from "@/components/site/figures";
import { Reveal, RevealStagger } from "@/components/site/motion";
import {
  Band,
  ClosingCta,
  Inner,
  NoteCards,
  PageHero,
  SectionHeader,
} from "@/components/site/publicSections";
import {
  governanceCommitments,
  governanceGates,
  governanceHero,
  governanceOperatorControls,
  governanceRightsPacket,
} from "@/data/publicSiteCopy";
import {
  robotPolicyBeachheadShort,
  robotPolicyEvaluationBoundary,
} from "@/data/robotPolicyEvaluationClaims";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const operatorHref =
  "/contact/site-operator?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=governance";

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

      <PageHero
        eyebrow={governanceHero.eyebrow}
        title={governanceHero.title}
        body={governanceHero.body}
        chips={governanceHero.chips}
        ctaHref={operatorHref}
        ctaLabel="Scope a benchmark"
        secondaryHref="/for-site-operators"
        secondaryLabel="Site-operator use case"
        imageSrc="/redesign/pov/retail-backroom.jpg"
        imageAlt="Retail backroom aisle with restricted areas kept out of scope"
        imageCaption="Capture scope · operator approved"
      />

      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="01"
            eyebrow="Who decides what"
            title="A hard line between what you decide and what we owe you."
            lede="Access, redaction, and permitted evidence use are recorded per site and per run, not assumed. Nothing crosses this line implicitly — and safety approval never crosses it at all."
            onInk
          />
          <div className="mt-12 grid gap-x-12 gap-y-10 lg:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">
                You decide
              </p>
              <NoteCards items={governanceOperatorControls} onInk className="mt-6 sm:grid-cols-1" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-300">
                We are accountable for
              </p>
              <ul className="mt-6 space-y-4">
                {governanceCommitments.map((item) => (
                  <li key={item} className="flex gap-3 border-t border-white/15 pt-4">
                    <ShieldCheck
                      className="mt-0.5 h-[1.05rem] w-[1.05rem] shrink-0 text-proof-500"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <p className="max-w-[46ch] text-[14px] leading-[1.7] text-ink-300">{item}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Reveal className="mt-12">
            <p className="max-w-[62ch] font-mono text-[11.5px] leading-[1.7] text-ink-300">
              Eval envelope: {robotPolicyBeachheadShort} · dexterous, contact-rich manipulation out
              of scope for now.
            </p>
          </Reveal>
        </Inner>
      </Band>

      <Band tone="canvas" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="02"
            eyebrow="Four gates"
            title="Every capture passes the same four gates."
            lede="Each gate is a readable record you can check before treating a site as usable."
          />
          <NoteCards items={governanceGates} className="mt-12" />
        </Inner>
      </Band>

      <Band tone="white">
        <Inner className="py-20 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
            <Figure
              title="What stays attached to a capture"
              subtitle="The rights record a buyer reads before access — field names and example values, not a live record."
              illustrative
            >
              <RevealStagger childAs="div" step={0.05} className="divide-y divide-line-soft">
                {governanceRightsPacket.map((row) => (
                  <DataField key={row.label} label={row.label} value={row.value} mono border={false} />
                ))}
              </RevealStagger>
            </Figure>

            <Reveal>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500">
                The hard limit
              </p>
              <h2 className="mt-5 max-w-[26ch] font-display text-[clamp(1.9rem,3.2vw,2.9rem)] font-medium leading-[1.04] tracking-[-0.035em] text-ink-900">
                The line we will not cross.
              </h2>
              <p className="mt-6 max-w-[48ch] text-[15.5px] leading-[1.75] text-ink-500">
                {robotPolicyEvaluationBoundary}
              </p>
              <div className="mt-8">
                <ProofBoundary level="block" title="No capture of restricted or private areas">
                  Blueprint does not capture, list, or commercialize restricted, private, or
                  employee-only areas without explicit operator approval, and it does not claim
                  deployment readiness, safety certification, or guaranteed outcomes. If a capture
                  cannot prove its rights and provenance, it does not ship.
                </ProofBoundary>
              </div>
              <div className="mt-8 flex flex-wrap gap-2">
                <StatusChip tone="proof" square>
                  Rights readable before access
                </StatusChip>
                <StatusChip tone="info" square>
                  Privacy processing recorded
                </StatusChip>
                <StatusChip tone="warn" square>
                  Safety approval stays external
                </StatusChip>
              </div>
            </Reveal>
          </div>
        </Inner>
      </Band>

      <ClosingCta
        eyebrow="For site operators"
        title="Set the boundaries first."
        body="Tell us the job, the windows we may capture in, the areas that stay off limits, and what evidence use you permit. The run is scoped inside those limits, not around them."
        primaryHref={operatorHref}
        primaryLabel="Scope a benchmark"
        secondaryHref="/for-site-operators"
        secondaryLabel="Site-operator use case"
        imageSrc="/redesign/pov/cold-storage.jpg"
        imageAlt="Cold-storage aisle captured inside operator-approved limits"
      />
    </>
  );
}
