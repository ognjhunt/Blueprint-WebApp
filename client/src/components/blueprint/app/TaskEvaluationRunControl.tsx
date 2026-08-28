import { useEffect, useState } from "react";
import { ListChecks, LockKeyhole } from "lucide-react";

import { Button, Card, ProofBoundary, StatusChip } from "@/components/blueprint";
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

  if (!control || control.state === "not_available") {
    return (
      <Card pad="lg" className="flex flex-col gap-4">
        <div>
          <h3 className="font-display uppercase text-title-m font-semibold tracking-[0.005em] text-runway-text">Create the Evidence Plan</h3>
          <p className="mt-2 text-body-s text-runway-body">
            Pipeline will decompose the approved task and select qualified claim-level methods from its immutable catalog. This interface cannot choose providers or qualifications.
          </p>
        </div>
        <Button type="button" variant="action" iconLeft={<ListChecks />} disabled={busy} onClick={onPlan}>
          {busy ? "Planning…" : "Plan Task Evaluation Run"}
        </Button>
      </Card>
    );
  }

  if (control.state === "pipeline_artifact_invalid") {
    return <ProofBoundary level="block" title="Run control artifact invalid">Pipeline planning data failed an integrity or binding check. Execution remains blocked.</ProofBoundary>;
  }

  if (control.state === "planning" || control.state === "planning_failed") {
    return (
      <Card pad="lg">
        <StatusChip tone={control.state === "planning_failed" ? "block" : "neutral"} square>
          {control.state.replace(/_/g, " ")}
        </StatusChip>
        <p className="mt-3 text-body-s text-runway-body">
          {control.blocker || "Pipeline is compiling the deterministic claim-level Evidence Plan."}
        </p>
        {control.state === "planning_failed" ? (
          <Button className="mt-4" type="button" variant="secondary" disabled={busy} onClick={onPlan}>Retry planning</Button>
        ) : null}
      </Card>
    );
  }

  if (!isPreparedControl(control)) return null;

  if (control.state === "authorized") {
    return (
      <Card pad="lg" className="flex flex-col gap-4">
        <ProofBoundary level="proof" title="Local execution explicitly authorized" icon={LockKeyhole}>
          The customer authorized {control.authorized_adapter_references.length} Pipeline-selected adapter(s) for this exact plan. This authorization does not qualify a method, approve paid or live-provider execution, permit a physical robot run, or establish physical success. Authorization digest: {control.authorization_digest}
        </ProofBoundary>
        <Button type="button" variant="action" disabled={busy} onClick={onExecute}>
          {busy ? "Executing and aggregating…" : "Execute authorized local methods"}
        </Button>
      </Card>
    );
  }

  function toggle(reference: string) {
    setSelected((current) => current.includes(reference)
      ? current.filter((value) => value !== reference)
      : [...current, reference].sort());
  }

  return (
    <Card pad="lg" className="flex flex-col gap-5">
      <div>
        <StatusChip tone={control.state === "authorization_failed" ? "block" : "warn"} square>
          {control.state.replace(/_/g, " ")}
        </StatusChip>
        <h3 className="mt-3 font-display uppercase text-title-m font-semibold tracking-[0.005em] text-runway-text">Approve exact execution methods</h3>
        <p className="mt-2 text-body-s text-runway-body">
          Pipeline selected these candidates from catalog {control.method_catalog.catalog_id} {control.method_catalog.version}. Review cost and proof tier, then explicitly authorize the local methods you permit.
        </p>
      </div>

      {candidates.length ? (
        <div className="divide-y divide-runway-line-soft border border-runway-line bg-runway-panel">
          {candidates.map((candidate) => (
            <label key={candidate.adapter_reference} className="flex cursor-pointer items-start gap-3 p-4">
              <input
                className="mt-1"
                type="checkbox"
                checked={selected.includes(candidate.adapter_reference)}
                onChange={() => toggle(candidate.adapter_reference)}
              />
              <span className="min-w-0 flex-1">
                <span className="runway-num block text-body-s font-semibold text-runway-text">{candidate.method_id} · {candidate.method_version}</span>
                <span className="mt-1 block text-body-xs text-runway-mute">
                  {candidate.method_family.replace(/_/g, " ")} · {candidate.proof_tier.replace(/_/g, " ")} · <span className="runway-num">${candidate.expected_cost_usd.toFixed(2)}</span> expected
                </span>
                <span className="runway-num mt-1 block break-all text-[0.67rem] text-runway-faint">{candidate.adapter_reference}</span>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <ProofBoundary level="warn" title="No executable local method selected">
          The plan contains no authorized local adapter candidate. Authorizing an empty set cannot create physical or scientific evidence; the eventual run must abstain or request the next experiment.
        </ProofBoundary>
      )}

      {control.blocker ? <p className="text-body-s text-runway-red">{control.blocker}</p> : null}
      <ProofBoundary level="warn" title="Authorization boundary">
        Authorization permits only the selected, already-qualified local adapters for this exact plan digest. It does not authorize paid compute, a live external provider, a physical robot, deployment, safety certification, or comparative policy ranking.
      </ProofBoundary>
      <Button type="button" variant="action" iconLeft={<LockKeyhole />} disabled={busy} onClick={() => onAuthorize(selected)}>
        {busy ? "Authorizing…" : `Authorize ${selected.length} selected method${selected.length === 1 ? "" : "s"}`}
      </Button>
    </Card>
  );
}
