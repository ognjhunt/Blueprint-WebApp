import { loadManagedJobEvidence } from "./jobManagedEvaluation";
import { taskScreeningEvidence, type TaskScreeningReadback, type TaskScreeningScope } from "./taskScreeningEvidence";

/** Reuses canonical publication, task, capture, source and current consent validation. */
export async function readCurrentTaskScreening(scope: TaskScreeningScope): Promise<TaskScreeningReadback> {
  const unavailable = (reason: string) => ({ ...taskScreeningEvidence(scope, [], new Date().toISOString()), unavailable_reason: reason });
  if (!scope.briefDigest) return unavailable("current_task_brief_unavailable");
  try {
    return taskScreeningEvidence(scope, await loadManagedJobEvidence(scope.requestId, scope.briefDigest, { pageAll: true }), new Date().toISOString());
  } catch {
    return unavailable("current_task_screening_readback_unavailable");
  }
}
