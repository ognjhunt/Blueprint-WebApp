import type { User as FirebaseUser } from "firebase/auth";

import type { TaskEvaluationResultSiteRecord } from "@/lib/taskEvaluationResults";
import { ProofBoundary } from "@/components/blueprint";
import {
  applyPolicyCanaryEpisodeInterpretation,
  applyPolicyCanaryScoreCorrection,
} from "@/lib/policyCanaryResultPortal";
import { findPublishedTaskSuccessContract } from "@/lib/rigidTaskSuccessContract";
import { PolicyCanaryEvidenceInventory } from "./PolicyCanaryEvidenceInventory";
import { PolicyCanaryEpisodeExplorer } from "./PolicyCanaryEpisodeExplorer";
import { PolicyCanaryPrimarySummary } from "./PolicyCanaryPrimarySummary";
import { PolicyCanaryReportOverview } from "./PolicyCanaryReportOverview";
import { TaskSuccessContractPanel } from "./TaskSuccessContractPanel";

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
  const correction = projectedResult.score_correction;
  const successContract = findPublishedTaskSuccessContract(
    projectedResult.publication,
  );
  return <div className="flex flex-col gap-6">
    {correction ? <ProofBoundary level="warn" title="Deterministic score correction applied; original preserved">
      Episode labels, failure reasons, event ledgers, and candidate success counts below use the verified deterministic rescore. The original completed-unqualified publication and score receipts remain unchanged. This run is still unqualified and no winner is declared.
    </ProofBoundary> : null}
    {projectedResult.episode_interpretation ? <ProofBoundary level="warn" title="Independent episode interpretation backfill applied">
      The learned explanations below were added after the original publication. They preserve the deterministic scores, cannot change ranking or promotion, and remain bound to this exact run.
    </ProofBoundary> : null}
    <PolicyCanaryPrimarySummary result={projectedResult} user={user} />
    {successContract ? <TaskSuccessContractPanel
      contract={successContract}
      title="Success criteria used for this result"
    /> : <ProofBoundary level="warn" title="Exact task success contract not delivered">
      This result does not carry the immutable task/site criteria used by the scorer. Do not reinterpret completion from the review video alone.
    </ProofBoundary>}
    <PolicyCanaryEpisodeExplorer result={projectedResult} user={user} />
    <PolicyCanaryReportOverview result={projectedResult} />
    <PolicyCanaryEvidenceInventory result={projectedResult} user={user} />
  </div>;
}
