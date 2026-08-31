import type { User as FirebaseUser } from "firebase/auth";

import type { TaskEvaluationResultSiteRecord } from "@/lib/taskEvaluationResults";
import { PolicyCanaryEvidenceInventory } from "./PolicyCanaryEvidenceInventory";
import { PolicyCanaryEpisodeExplorer } from "./PolicyCanaryEpisodeExplorer";
import { PolicyCanaryReportOverview } from "./PolicyCanaryReportOverview";

export function PolicyCanaryResultPortal({
  result,
  user,
}: {
  result: TaskEvaluationResultSiteRecord;
  user: FirebaseUser;
}) {
  return <div className="flex flex-col gap-6">
    <PolicyCanaryReportOverview result={result} />
    <PolicyCanaryEpisodeExplorer result={result} user={user} />
    <PolicyCanaryEvidenceInventory result={result} user={user} />
  </div>;
}
