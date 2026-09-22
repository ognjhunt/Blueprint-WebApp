import { Tag } from "@/components/workspace/WorkspaceUI";
import type { CaptureTaskEvaluationRunInspection } from "@/lib/captureUploads";

const outcomeLabels = {
  decided: "Decision",
  partially_decided: "Partial decision",
  abstained: "No decision",
} as const;

const verdictLabels: Record<string, [string, "green" | "red" | "neutral"]> = {
  supported: ["Supported", "green"],
  not_supported: ["Not supported", "red"],
  abstention: ["Undecided", "neutral"],
};

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

/** The per-claim answers, the next step, and what isn't covered; the exact plan stays in a drawer. */
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
    <section aria-labelledby="task-evaluation-run-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="task-evaluation-run-heading">Result</h2>
        <Tag tone={inspection.status === "decided" ? "green" : "neutral"}>{outcomeLabels[inspection.status]}</Tag>
      </div>
      <p className="mt-2 text-sm text-ink-600">
        These answers apply only inside this testbed, and they don't rank policies against each other.
      </p>

      <ul className="mt-5 flex flex-col">
        {envelope.per_claim_verdicts.map((claim) => {
          const [label, tone] = verdictLabels[claim.verdict] || [humanize(claim.verdict), "neutral"];
          return (
            <li key={claim.claim_id} className="border-t border-line py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <strong className="font-medium">{humanize(claim.claim_type)}</strong>
                <Tag tone={tone}>{label}</Tag>
              </div>
              <p className="mt-1">{humanize(claim.rationale)}</p>
            </li>
          );
        })}
      </ul>

      <h3 className="mt-8 text-lg">Next step</h3>
      <p className="mt-2">{humanize(envelope.next_cheapest_experiment)}</p>
      {physicalRequests.length ? (
        <>
          <p className="mt-3 text-sm text-ink-600">Physical evidence still needed:</p>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {physicalRequests.map((request, index) => (
              <li key={`${String(request.request_id || request.claim_id || "physical-request")}-${index}`}>
                {String(request.description || request.evidence_needed || request.claim_id || "Physical evidence")}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {envelope.unsupported_conditions.length ? (
        <>
          <h3 className="mt-8 text-lg">Not covered</h3>
          <ul className="mt-2 list-disc pl-5">
            {envelope.unsupported_conditions.map((condition) => <li key={condition}>{humanize(condition)}</li>)}
          </ul>
        </>
      ) : null}

      {envelope.cross_method_disagreements.length ? (
        <p className="mt-6">
          The test methods disagreed {envelope.cross_method_disagreements.length === 1 ? "once" : `${envelope.cross_method_disagreements.length} times`}.
          Run the next step before relying on the affected answers.
        </p>
      ) : null}

      <details className="mt-8">
        <summary>Full plan and decision</summary>
        <button type="button" className="ws-link" onClick={download}>Download the run (JSON)</button>
        <p className="mt-2 break-all text-xs text-ink-500">{publication.run_id} · {envelope.decision_envelope_digest}</p>
        <ul className="mt-2 text-xs text-ink-500">
          {envelope.per_claim_verdicts.map((claim) => <li key={claim.claim_id} className="break-all">{claim.claim_id}: {claim.verdict}</li>)}
        </ul>
        <pre className="mt-3 max-h-[32rem] overflow-auto text-xs leading-relaxed">
          {JSON.stringify({ evidence_plan: publication.evidence_plan, decision_envelope: envelope }, null, 2)}
        </pre>
      </details>
    </section>
  );
}
