import { useId } from "react";

import { Tag } from "@/components/workspace/WorkspaceUI";
import {
  describeTaskSuccessContract,
  type AnyTaskSuccessContract,
} from "@/lib/articulatedTaskSuccessContract";

const sourceLabels: Record<AnyTaskSuccessContract["provenance"]["author_source"], string> = {
  compatibility_default: "Task registry default",
  site_robot_team: "Site / robot team",
  task_owner: "Task owner",
  agent_proposal: "Agent proposal",
};

/** The rules that score each episode; a proposal needs the team's explicit confirmation. */
export function TaskSuccessContractPanel({
  contract,
  confirmationTeamId,
  proposalConfirmed = false,
  onProposalConfirmed,
  title = "Task success criteria",
}: {
  contract: AnyTaskSuccessContract;
  confirmationTeamId?: string;
  proposalConfirmed?: boolean;
  onProposalConfirmed?: (confirmed: boolean) => void;
  title?: string;
}) {
  const rows = describeTaskSuccessContract(contract);
  const headingId = useId();
  const isProposal = contract.provenance.confirmation_status === "proposal_only";
  return <section aria-labelledby={headingId}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id={headingId}>{title}</h2>
      <Tag tone={isProposal ? "neutral" : "green"}>{isProposal ? "Needs your confirmation" : "Confirmed"}</Tag>
    </div>
    <p className="mt-2 text-sm text-ink-600">
      These rules decide whether an episode succeeded. Anything forbidden that happens during the episode still counts,
      even if the robot recovers later.
    </p>
    {/* A proposal opens its rules, since confirming them is the next step; confirmed rules stay one click away. */}
    <details className="mt-4" open={isProposal}>
      <summary>The {rows.length} rules</summary>
      <dl className="ws-facts">
        {rows.map((row) => <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value.replace(/^./, (letter) => letter.toUpperCase())}<span className="block text-xs text-ink-500">{row.detail}</span></dd>
        </div>)}
      </dl>
      <p className="mt-3 break-all text-xs text-ink-500">
        Source: {sourceLabels[contract.provenance.author_source]} ({contract.provenance.author_id}) · Scope: {contract.scope.site_id} · {contract.scope.task_id}
        {" "}· Confirmed by: {contract.provenance.confirmed_by_team_id || (isProposal ? "not yet" : "registry default")} · {contract.contract_digest}
      </p>
    </details>
    {isProposal && onProposalConfirmed ? <label className="ws-check">
      <input type="checkbox" checked={proposalConfirmed} onChange={(event) => onProposalConfirmed(event.target.checked)} />
      <span>
        These criteria were proposed by an agent and can't score anything until your team confirms them. I confirm these
        exact criteria for this run on behalf of team {confirmationTeamId || "unavailable"}; this saves them as a new,
        unchangeable version.
      </span>
    </label> : null}
  </section>;
}
