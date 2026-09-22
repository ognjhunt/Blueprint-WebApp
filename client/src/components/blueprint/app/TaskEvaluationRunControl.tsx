import { useEffect, useState, type ReactNode } from "react";

import type {
  TaskEvaluationRunControlSummary,
  TaskEvaluationRunPreparedControl,
} from "@/lib/captureUploads";

function isPreparedControl(
  control: TaskEvaluationRunControlSummary | undefined,
): control is TaskEvaluationRunPreparedControl {
  return Boolean(control && (
    control.state === "authorization_required" ||
    control.state === "authorization_failed" ||
    control.state === "authorized"
  ));
}

export function TaskEvaluationRunControl({
  control,
  busy,
  onPlan,
  onAuthorize,
  onExecute,
}: {
  control: TaskEvaluationRunControlSummary | undefined;
  busy: boolean;
  onPlan: () => void;
  onAuthorize: (adapterReferences: string[]) => void;
  onExecute: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const candidates = isPreparedControl(control)
    ? control.authorization_candidates
    : [];

  useEffect(() => {
    if (!isPreparedControl(control) || control.state === "authorized") return;
    setSelected(control.authorization_candidates.map((candidate) => candidate.adapter_reference));
  }, [control]);

  const frame = (children: ReactNode) => (
    <section aria-labelledby="run-control-heading">
      <h2 id="run-control-heading">Evaluation</h2>
      {children}
    </section>
  );

  if (!control || control.state === "not_available") {
    return frame(<>
      <p className="mt-2">Blueprint picks the test methods for the approved task. Nothing runs until you approve them.</p>
      <button type="button" className="ws-primary mt-5" disabled={busy} onClick={onPlan}>{busy ? "Planning…" : "Plan the evaluation"}</button>
    </>);
  }

  if (control.state === "pipeline_artifact_invalid") {
    return frame(<div className="ws-alert mt-4" role="alert"><p>The evaluation plan failed an integrity check, so it can't run.</p></div>);
  }

  if (control.state === "planning" || control.state === "planning_failed") {
    return frame(<>
      <p className="mt-2">{control.blocker || (control.state === "planning_failed" ? "Planning failed." : "Planning the evaluation…")}</p>
      {control.state === "planning_failed" ? (
        <button type="button" className="ws-secondary mt-5" disabled={busy} onClick={onPlan}>Try planning again</button>
      ) : null}
    </>);
  }

  if (!isPreparedControl(control)) return null;

  if (control.state === "authorized") {
    return frame(<>
      <p className="mt-2">You approved {control.authorized_adapter_references.length} method{control.authorized_adapter_references.length === 1 ? "" : "s"} for this plan.</p>
      <button type="button" className="ws-primary mt-5" disabled={busy} onClick={onExecute}>{busy ? "Running…" : "Run the approved methods"}</button>
      <p className="mt-3 break-all text-xs text-ink-500">Approval {control.authorization_digest}</p>
    </>);
  }

  function toggle(reference: string) {
    setSelected((current) => current.includes(reference)
      ? current.filter((value) => value !== reference)
      : [...current, reference].sort());
  }

  return frame(<>
    <p className="mt-2">
      Choose which methods may run. Approving lets only these local methods run for this plan. It doesn't approve paid
      compute, an outside provider, or a physical robot.
    </p>
    {control.state === "authorization_failed" ? <p className="mt-2 text-runway-red">The last approval didn't go through. Try again.</p> : null}
    {candidates.length ? (
      <fieldset className="mt-4">
        <legend className="sr-only">Methods</legend>
        {candidates.map((candidate) => (
          <label key={candidate.adapter_reference} className="ws-check">
            <input
              type="checkbox"
              checked={selected.includes(candidate.adapter_reference)}
              onChange={() => toggle(candidate.adapter_reference)}
            />
            <span>
              {candidate.method_id} · {candidate.method_version}
              <span className="block text-sm text-ink-500">
                {candidate.method_family.replace(/_/g, " ")} · {candidate.proof_tier.replace(/_/g, " ")} · ${candidate.expected_cost_usd.toFixed(2)} expected
              </span>
            </span>
          </label>
        ))}
      </fieldset>
    ) : (
      <p className="mt-4">No method can run for this plan, so the evaluation will end without a decision and suggest the next step.</p>
    )}
    {control.blocker ? <p className="mt-3 text-runway-red">{control.blocker}</p> : null}
    <button type="button" className="ws-primary mt-6" disabled={busy} onClick={() => onAuthorize(selected)}>
      {busy ? "Approving…" : `Approve ${selected.length} method${selected.length === 1 ? "" : "s"}`}
    </button>
    <details className="mt-6">
      <summary>Plan details</summary>
      <p className="text-sm">Method catalog {control.method_catalog.catalog_id} {control.method_catalog.version}</p>
      <ul className="mt-2 text-xs text-ink-500">
        {candidates.map((candidate) => <li key={candidate.adapter_reference} className="break-all">{candidate.adapter_reference}</li>)}
      </ul>
    </details>
  </>);
}
