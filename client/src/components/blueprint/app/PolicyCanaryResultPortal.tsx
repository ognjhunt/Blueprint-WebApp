import type { User as FirebaseUser } from "firebase/auth";

import type { TaskEvaluationResultSiteRecord } from "@/lib/taskEvaluationResults";
import { ProofBoundary } from "@/components/blueprint";
import { applyPolicyCanaryScoreCorrection } from "@/lib/policyCanaryResultPortal";
import { PolicyCanaryEvidenceInventory } from "./PolicyCanaryEvidenceInventory";
import { PolicyCanaryEpisodeExplorer } from "./PolicyCanaryEpisodeExplorer";
import { PolicyCanaryPrimarySummary } from "./PolicyCanaryPrimarySummary";
import { PolicyCanaryReportOverview } from "./PolicyCanaryReportOverview";

export function PolicyCanaryResultPortal({
  result,
  user,
}: {
  result: TaskEvaluationResultSiteRecord;
  user: FirebaseUser | null;
}) {
  const projectedResult = applyPolicyCanaryScoreCorrection(result);
  const correction = projectedResult.score_correction;
  return <div className="flex flex-col gap-6">
    {correction ? <ProofBoundary level="warn" title="Deterministic score correction applied; original preserved">
      Episode labels, failure reasons, event ledgers, and candidate success counts below use the verified deterministic rescore. The original completed-unqualified publication and score receipts remain unchanged. This run is still unqualified and no winner is declared.
    </ProofBoundary> : null}
    <PolicyCanaryPrimarySummary result={projectedResult} user={user} />
    <PolicyCanaryEpisodeExplorer result={projectedResult} user={user} />
    <PolicyCanaryReportOverview result={projectedResult} />
    <PolicyCanaryEvidenceInventory result={projectedResult} user={user} />
  </div>;
}
