import { Helmet } from "@/lib/helmet";
import { ArrowLeftRight, PackageCheck } from "lucide-react";

import {
  Button,
  Card,
  DataField,
  Eyebrow,
  ProofBoundary,
  StatusChip,
} from "@/components/blueprint";
import { OpsShell } from "@/components/blueprint/ops/OpsShell";
import { MonochromeMedia } from "@/components/site/editorial";
import {
  EVIDENCE_COVERAGE_BOUNDARY,
  EVIDENCE_FRAMES,
  EVIDENCE_MANIFEST,
  EVIDENCE_PROVENANCE,
  EVIDENCE_QA_GATES,
  type ProvenanceEvent,
} from "@/components/blueprint/ops/mockData";
import { cn } from "@/lib/utils";

/**
 * Evidence review — /ops/evidence
 *
 * The operator surface for clearing a capture bundle before it can be packaged
 * for a buyer. Layout:
 *  - capture-frame board: POV grid (review media, not real-world proof)
 *  - QA gates list: pass / review / fail StatusChips
 *  - capture manifest: DataField card
 *  - provenance timeline: dotted vertical rail, mono times
 *  - coverage ProofBoundary (warn)
 *  - Return-to-supply / Accept-&-package actions
 *
 * All media here is placeholder/illustrative and is labeled as review support,
 * never real-world proof. Counts and ids are mock — there is no backend.
 */

function ProvenanceStateDot({ state }: { state: ProvenanceEvent["state"] }) {
  if (state === "active") {
    return (
      <span className="relative z-10 mt-0.5 flex h-3 w-3 items-center justify-center">
        <span className="absolute inline-flex h-3 w-3 rounded-full bg-warn-bg" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-warn-fg" />
      </span>
    );
  }
  if (state === "done") {
    return (
      <span className="relative z-10 mt-0.5 inline-flex h-3 w-3 items-center justify-center rounded-full bg-proof-bg">
        <span className="h-1.5 w-1.5 rounded-full bg-proof-fg" />
      </span>
    );
  }
  // pending
  return (
    <span className="relative z-10 mt-0.5 inline-flex h-3 w-3 items-center justify-center rounded-full border border-line bg-white">
      <span className="h-1 w-1 rounded-full bg-ink-300" />
    </span>
  );
}

function ProvenanceTimeline() {
  return (
    <ol className="relative flex flex-col">
      {/* dotted vertical rail */}
      <span
        aria-hidden="true"
        className="absolute left-[5px] top-2 bottom-2 w-px border-l border-dashed border-line-strong"
      />
      {EVIDENCE_PROVENANCE.map((event) => (
        <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
          <ProvenanceStateDot state={event.state} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-3">
              <span
                className={cn(
                  "text-[0.85rem] font-medium leading-tight",
                  event.state === "pending" ? "text-ink-400" : "text-ink-900",
                )}
              >
                {event.label}
              </span>
              <span className="shrink-0 font-mono text-[0.72rem] text-ink-500">
                {event.time}
              </span>
            </div>
            <span className="text-[0.78rem] leading-snug text-ink-500">
              {event.detail}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function EvidenceReview() {
  return (
    <>
      <Helmet>
        <title>Evidence review · Blueprint Ops</title>
        <meta
          name="description"
          content="Internal ops console — capture-bundle evidence review with QA gates, manifest, provenance, and coverage boundaries. Illustrative data, not live readiness."
        />
      </Helmet>

      <OpsShell
        active="evidence"
        title="Evidence review"
        sub="CAP-2049-07 · Northgate Fulfillment · tote induction"
        actions={
          <StatusChip tone="warn" square>
            In review
          </StatusChip>
        }
      >
        <div className="flex flex-col gap-6">
          {/* Two-column working area */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.55fr_1fr]">
            {/* LEFT — capture-frame board */}
            <div className="flex flex-col gap-4">
              <Card
                tone="card"
                pad="md"
                eyebrow="Capture frames"
                title="Walkthrough segments"
                headerRight={
                  <span className="font-mono text-[0.72rem] text-ink-500">
                    {EVIDENCE_FRAMES.length} segments
                  </span>
                }
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {EVIDENCE_FRAMES.map((frame) => (
                    <figure
                      key={frame.id}
                      className="overflow-hidden border border-line bg-ink"
                    >
                      <MonochromeMedia
                        src={frame.src}
                        alt={frame.alt}
                        radius="none"
                        overlay="bg"
                        className="aspect-[4/3]"
                      />
                      <figcaption className="flex items-center justify-between gap-2 border-t border-line bg-white px-2.5 py-1.5">
                        <span className="font-mono text-[0.68rem] text-ink-500">
                          {frame.caption}
                        </span>
                        <span className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-ink-400">
                          {frame.id}
                        </span>
                      </figcaption>
                    </figure>
                  ))}
                </div>

                <p className="mt-4 font-mono text-[0.7rem] leading-relaxed text-ink-400">
                  Review media — frames are placeholder captures for operator
                  review, not real-world proof of robot performance.
                </p>
              </Card>

              {/* Coverage boundary */}
              <ProofBoundary level="warn" title={EVIDENCE_COVERAGE_BOUNDARY.title}>
                {EVIDENCE_COVERAGE_BOUNDARY.body}
              </ProofBoundary>

              {/* Decision actions */}
              <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-end">
                <Button
                  variant="secondary"
                  size="md"
                  iconLeft={<ArrowLeftRight aria-hidden="true" />}
                >
                  Return to supply
                </Button>
                <Button
                  variant="action"
                  size="md"
                  iconLeft={<PackageCheck aria-hidden="true" />}
                  disabled
                >
                  Accept &amp; package
                </Button>
              </div>
              <p className="text-right text-[0.72rem] text-ink-400">
                Accept &amp; package unlocks once the open coverage and privacy
                gates clear.
              </p>
            </div>

            {/* RIGHT — gates, manifest, provenance */}
            <div className="flex flex-col gap-4">
              {/* QA gates */}
              <Card tone="card" pad="md" eyebrow="QA gates" title="Automated checks">
                <ul className="flex flex-col">
                  {EVIDENCE_QA_GATES.map((gate, index) => (
                    <li
                      key={gate.id}
                      className={cn(
                        "flex items-start justify-between gap-3 py-3",
                        index < EVIDENCE_QA_GATES.length - 1 &&
                          "border-b border-line-soft",
                      )}
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-[0.85rem] font-medium leading-tight text-ink-900">
                          {gate.label}
                        </span>
                        <span className="text-[0.76rem] leading-snug text-ink-500">
                          {gate.detail}
                        </span>
                      </div>
                      <StatusChip tone={gate.statusTone} square className="shrink-0">
                        {gate.statusLabel}
                      </StatusChip>
                    </li>
                  ))}
                </ul>
              </Card>

              {/* Capture manifest */}
              <Card
                tone="card"
                pad="md"
                eyebrow="Manifest"
                title="Capture manifest"
                framed
              >
                <div className="flex flex-col">
                  {EVIDENCE_MANIFEST.map((entry, index) => (
                    <DataField
                      key={entry.label}
                      label={entry.label}
                      value={entry.value}
                      border={index < EVIDENCE_MANIFEST.length - 1}
                      trailing={
                        entry.chipLabel ? (
                          <StatusChip tone={entry.chipTone} square>
                            {entry.chipLabel}
                          </StatusChip>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              </Card>

              {/* Provenance timeline */}
              <Card
                tone="card"
                pad="md"
                eyebrow="Provenance"
                title="Chain of custody"
              >
                <ProvenanceTimeline />
              </Card>
            </div>
          </div>
        </div>
      </OpsShell>
    </>
  );
}
