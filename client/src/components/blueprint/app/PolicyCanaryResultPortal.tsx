import type { User as FirebaseUser } from "firebase/auth";

import type { TaskEvaluationResultSiteRecord } from "@/lib/taskEvaluationResults";
import {
  applyPolicyCanaryEpisodeInterpretation,
  applyPolicyCanaryScoreCorrection,
  canaryCandidateSummaries,
  formatCanaryPValue,
  pairedCanaryComparison,
} from "@/lib/policyCanaryResultPortal";
import {
  describeTaskSuccessContract,
  findPublishedTaskSuccessContract,
  type AnyTaskSuccessContract,
} from "@/lib/articulatedTaskSuccessContract";
import { PolicyCanaryControls } from "./PolicyCanaryControls";
import { PolicyCanaryEvidenceInventory } from "./PolicyCanaryEvidenceInventory";
import { PolicyCanaryEpisodeExplorer } from "./PolicyCanaryEpisodeExplorer";
import { PolicyCanaryPrimarySummary } from "./PolicyCanaryPrimarySummary";

const authorLabels: Record<AnyTaskSuccessContract["provenance"]["author_source"], string> = {
  compatibility_default: "Task registry default",
  site_robot_team: "Site / robot team",
  task_owner: "Task owner",
  agent_proposal: "Agent proposal",
};

/** "cleared" reads as "Cleared"; identifiers such as robot_background stay as recorded. */
function sentenceCase(value: string) {
  return !value || value.includes("_") ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

function CriteriaList({ contract }: { contract: AnyTaskSuccessContract }) {
  const provenance = contract.provenance;
  const confirmation = provenance.confirmation_status === "proposal_only"
    ? "proposal, not confirmed by a team"
    : provenance.author_source === "compatibility_default"
      ? "registry default, not confirmed by your team"
      : `confirmed by team ${provenance.confirmed_by_team_id || "(not recorded)"}`;
  return <>
    <dl className="grid gap-x-8 sm:grid-cols-2">
      {describeTaskSuccessContract(contract).map((row) => <div key={row.label} className="border-t border-line py-2.5">
        <dt className="text-ink-500">{row.label}</dt>
        <dd>{sentenceCase(row.value)}<span className="block text-ink-500">{row.detail}</span></dd>
      </div>)}
    </dl>
    <p className="break-all text-xs text-ink-500">
      Set by {authorLabels[provenance.author_source]} ({provenance.author_id}) · {confirmation} · contract {contract.contract_digest}
    </p>
  </>;
}

function ScoringDetails({
  result,
  contract,
  correctedContract,
}: {
  result: TaskEvaluationResultSiteRecord;
  contract: AnyTaskSuccessContract | null;
  correctedContract: NonNullable<TaskEvaluationResultSiteRecord["corrected_scoring_contract"]> | null;
}) {
  const comparison = pairedCanaryComparison(result);
  const intervals = canaryCandidateSummaries(result).filter((summary) => summary.wilson);
  const [first, second] = comparison?.leader
    ? [comparison.leader, comparison.candidates.find((candidate) => candidate !== comparison.leader)!]
    : comparison?.candidates || [];
  const pText = comparison?.pValue === null || comparison?.pValue === undefined
    ? ""
    : ` (two-sided exact sign test ${formatCanaryPValue(comparison.pValue)})`;
  return <details>
    <summary>How this was scored</summary>
    <div className="flex max-w-4xl flex-col gap-4 text-sm text-ink-700">
      <p>
        An episode counts as completed only when it meets every rule below. Episodes that stop before
        they can be scored, for example on a run error, are left out of the counts rather than treated
        as failures.
      </p>
      {comparison?.comparablePairs && first && second ? <p>
        Both policies were scored on {comparison.comparablePairs} of the same
        scenario{comparison.comparablePairs === 1 ? "" : "s"}. {comparison.discordantPairs
          ? `${first.display_name} alone succeeded on ${comparison.leaderOnlyWins} and ${second.display_name} alone on ${comparison.laggardOnlyWins}${pText}.`
          : "Neither succeeded where the other failed."}
      </p> : null}
      {intervals.length ? <p>
        95% confidence intervals for the completion rate: {intervals.map((summary) => (
          `${summary.display_name} ${Math.round(summary.wilson!.lower * 100)}–${Math.round(summary.wilson!.upper * 100)}%`
        )).join(", ")}.
      </p> : null}
      {contract ? <CriteriaList contract={contract} /> : <p>Success criteria weren't delivered with this result.</p>}
      {correctedContract ? <>
        <h3 className="mt-2 text-base font-medium">Criteria used for corrected scores</h3>
        <p>
          {correctedContract.team_confirmation_recorded
            ? "These criteria record a team confirmation."
            : "These criteria are a registry default without team confirmation."}{" "}
          They explain the corrected scores and don't replace the original request's authorization.
        </p>
        <CriteriaList contract={correctedContract.contract} />
      </> : null}
    </div>
  </details>;
}

export function PolicyCanaryResultPortal({
  result,
  user,
}: {
  result: TaskEvaluationResultSiteRecord;
  user: FirebaseUser | null;
}) {
  const projectedResult = applyPolicyCanaryEpisodeInterpretation(
    applyPolicyCanaryScoreCorrection(result),
  );
  const successContract = findPublishedTaskSuccessContract(
    projectedResult.publication,
  );
  const correctedCandidate = projectedResult.corrected_scoring_contract;
  const correctedContract = correctedCandidate
    && correctedCandidate.source_correction_digest === projectedResult.score_correction?.correction.correction_digest
    && correctedCandidate.source_projection_digest === projectedResult.publication.policy_canary_result?.projection_digest
    && correctedCandidate.source_delivery_digest === projectedResult.publication.result_delivery?.delivery_digest
    && correctedCandidate.original_request_authorization === false
    && correctedCandidate.contract.contract_digest !== successContract?.contract_digest
    ? correctedCandidate : null;
  return <div className="flex flex-col gap-14">
    <PolicyCanaryPrimarySummary
      result={projectedResult}
      user={user}
      contractDelivered={Boolean(successContract)}
      correctionApplied={Boolean(projectedResult.score_correction)}
      correctionRejected={Boolean(result.score_correction && !projectedResult.score_correction)}
    />
    <PolicyCanaryEpisodeExplorer result={projectedResult} user={user} />
    <div>
      <ScoringDetails result={projectedResult} contract={successContract} correctedContract={correctedContract} />
      <PolicyCanaryControls result={projectedResult} user={user} />
      <PolicyCanaryEvidenceInventory result={projectedResult} user={user} />
    </div>
  </div>;
}
