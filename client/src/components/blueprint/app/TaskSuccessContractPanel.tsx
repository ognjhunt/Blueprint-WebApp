import { Bot, CheckCircle2 } from "lucide-react";

import { ProofBoundary, StatusChip } from "@/components/blueprint";
import {
  describeRigidTaskSuccessContract,
  type RigidTaskSuccessContract,
} from "@/lib/rigidTaskSuccessContract";

const sourceLabels: Record<RigidTaskSuccessContract["provenance"]["author_source"], string> = {
  compatibility_default: "Task registry default",
  site_robot_team: "Site / robot team",
  task_owner: "Task owner",
  agent_proposal: "Agent proposal",
};

export function TaskSuccessContractPanel({
  contract,
  confirmationTeamId,
  proposalConfirmed = false,
  onProposalConfirmed,
  title = "Task success criteria",
}: {
  contract: RigidTaskSuccessContract;
  confirmationTeamId?: string;
  proposalConfirmed?: boolean;
  onProposalConfirmed?: (confirmed: boolean) => void;
  title?: string;
}) {
  const rows = describeRigidTaskSuccessContract(contract);
  const isProposal = contract.provenance.confirmation_status === "proposal_only";
  return <section className="runway-panel p-5" aria-labelledby="task-success-contract-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="runway-meta">Scoring authority</p>
        <h2 id="task-success-contract-title" className="mt-1 font-display text-title-m font-semibold uppercase text-ink-900">{title}</h2>
        <p className="mt-2 max-w-3xl text-body-s text-ink-500">These task- and site-bound rules decide completion. Terminal state and whole-episode events are evaluated separately, so a later recovery does not erase a prohibited earlier event.</p>
      </div>
      <StatusChip tone={isProposal ? "warn" : "proof"} square>
        {isProposal ? "Proposal — team confirmation required" : "Confirmed"}
      </StatusChip>
    </div>

    <dl className="mt-5 grid gap-px border border-line bg-line sm:grid-cols-2">
      {rows.map((row) => <div key={row.label} className="bg-paper-0 p-3">
        <dt className="runway-meta">{row.label}</dt>
        <dd className="mt-1 text-body-s font-semibold capitalize text-ink-900">{row.value}</dd>
        <p className="mt-1 text-caption text-ink-500">{row.detail}</p>
      </div>)}
    </dl>

    <div className="mt-4 grid gap-2 border-t border-line pt-4 text-caption text-ink-500 sm:grid-cols-2">
      <p><span className="font-semibold text-ink-700">Source:</span> {sourceLabels[contract.provenance.author_source]} · {contract.provenance.author_id}</p>
      <p className="runway-num break-all"><span className="font-sans font-semibold text-ink-700">Contract:</span> {contract.contract_digest}</p>
      <p><span className="font-semibold text-ink-700">Scope:</span> {contract.scope.site_id} · {contract.scope.task_id}</p>
      <p><span className="font-semibold text-ink-700">Confirmed by:</span> {contract.provenance.confirmed_by_team_id || (isProposal ? "Pending team confirmation" : "Registry-owned compatibility default")}</p>
    </div>

    {isProposal && onProposalConfirmed ? <div className="mt-5">
      <ProofBoundary level="warn" title="Agent interpretation is a proposal, not scoring authority" icon={Bot}>
        The agent-authored criteria cannot launch or grade an episode by themselves. Confirmation creates a new immutable document bound to the proposal digest and team identity.
      </ProofBoundary>
      <label className="mt-4 flex gap-3 text-body-s text-ink-700">
        <input
          type="checkbox"
          className="mt-1 size-4"
          checked={proposalConfirmed}
          onChange={(event) => onProposalConfirmed(event.target.checked)}
        />
        <span><span className="font-semibold">Confirm these exact criteria for this run.</span> I am acting for team <span className="runway-num">{confirmationTeamId || "unavailable"}</span>, and I understand this seals a new digest-bound contract.</span>
      </label>
    </div> : !isProposal ? <p className="mt-4 flex items-center gap-2 text-caption text-ink-600"><CheckCircle2 className="size-4 text-runway-signal" />This immutable contract is already confirmed and may be submitted unchanged.</p> : null}
  </section>;
}
