import { Download, FlaskConical, ShieldAlert } from "lucide-react";

import { Button, Card, ProofBoundary, StatusChip } from "@/components/blueprint";
import type { CaptureTaskEvaluationRunInspection } from "@/lib/captureUploads";

const outcomeLabel = {
  decided: "Decision ready",
  partially_decided: "Partial decision",
  abstained: "Abstained",
} as const;

function verdictTone(verdict: string): "proof" | "warn" | "block" {
  if (verdict === "supported") return "proof";
  if (verdict === "not_supported") return "block";
  return "warn";
}

export function TaskEvaluationRunInspection({
  inspection,
}: {
  inspection: CaptureTaskEvaluationRunInspection;
}) {
  const { publication } = inspection;
  const envelope = publication.decision_envelope;
  const physicalRequests = envelope.physical_evidence_still_required;

  function download() {
    const blob = new Blob([`${JSON.stringify(publication, null, 2)}\n`], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${publication.run_id}-${envelope.decision_envelope_digest.slice(7, 19)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="flex flex-col gap-5" aria-labelledby="task-evaluation-run-heading">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <StatusChip tone={inspection.status === "decided" ? "proof" : "warn"} square>
            {outcomeLabel[inspection.status]}
          </StatusChip>
          <h2 id="task-evaluation-run-heading" className="mt-3 font-display uppercase text-title-l font-semibold tracking-[0.005em] text-runway-text">
            Task Evaluation Run
          </h2>
          <p className="runway-num mt-2 text-[0.72rem] text-runway-faint">
            {publication.run_id} · {envelope.decision_envelope_digest}
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" iconLeft={<Download />} onClick={download}>
          Download exact run JSON
        </Button>
      </div>

      <ProofBoundary level="warn" title="Decision boundary" icon={ShieldAlert}>
        These claim-level decisions apply only inside the named testbed and evidence envelope. Simulation is not physical success; this run does not approve deployment or safety; comparative policy ranking remains thesis_not_supported.
      </ProofBoundary>

      <div className="grid gap-4 lg:grid-cols-2">
        {envelope.per_claim_verdicts.map((claim) => (
          <Card key={claim.claim_id} pad="md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="runway-meta font-semibold">{claim.claim_type.replace(/_/g, " ")}</p>
                <h3 className="runway-num mt-1 text-body-s font-semibold text-runway-text">{claim.claim_id}</h3>
              </div>
              <StatusChip tone={verdictTone(claim.verdict)} square>{claim.verdict.replace(/_/g, " ")}</StatusChip>
            </div>
            <p className="mt-3 text-body-s text-runway-body">{claim.rationale.replace(/_/g, " ")}</p>
          </Card>
        ))}
      </div>

      <Card pad="lg" className="grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="runway-meta flex items-center gap-2 font-semibold"><FlaskConical className="size-4" /> Next cheapest experiment</h3>
          <p className="mt-2 text-body-s font-semibold text-runway-text">{envelope.next_cheapest_experiment.replace(/_/g, " ")}</p>
          {physicalRequests.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-body-s text-runway-body">
              {physicalRequests.map((request, index) => (
                <li key={`${String(request.request_id || request.claim_id || "physical-request")}-${index}`}>
                  {String(request.description || request.evidence_needed || request.claim_id || "Physical evidence required")}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div>
          <h3 className="runway-meta font-semibold">Unsupported conditions</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-body-s text-runway-body">
            {envelope.unsupported_conditions.map((condition) => (
              <li key={condition}>{condition.replace(/_/g, " ")}</li>
            ))}
          </ul>
        </div>
      </Card>

      {envelope.cross_method_disagreements.length ? (
        <ProofBoundary level="warn" title="Evidence disagreement">
          The Pipeline recorded {envelope.cross_method_disagreements.length} cross-method disagreement(s). Inspect the exact artifact and run the next experiment before upgrading the affected claim.
        </ProofBoundary>
      ) : null}

      <details className="runway-panel p-4">
        <summary className="cursor-pointer text-body-s font-semibold text-runway-text">Inspect deterministic Evidence Plan and Decision Envelope</summary>
        <pre className="runway-num mt-4 max-h-[32rem] overflow-auto border border-runway-line bg-runway-black p-4 text-[0.7rem] leading-relaxed text-runway-body">
          {JSON.stringify({ evidence_plan: publication.evidence_plan, decision_envelope: envelope }, null, 2)}
        </pre>
      </details>
    </section>
  );
}
