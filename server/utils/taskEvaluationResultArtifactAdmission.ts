export type TaskEvaluationResultArtifactAdmission =
  | "denied"
  | "inline_delivery"
  | "pipeline_run_registry";

const SAFE_ARTIFACT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;
const LEGACY_ARTIFACT_ID = /^[0-9a-f]{32}$/;

export function taskEvaluationResultArtifactAdmission(
  publication: Record<string, any>,
  artifactId: string,
): TaskEvaluationResultArtifactAdmission {
  if (!SAFE_ARTIFACT_ID.test(artifactId)) return "denied";
  if (publication.schema_version === "task_evaluation_run_publication.v4") {
    return "pipeline_run_registry";
  }
  if (
    publication.schema_version !== "task_evaluation_run_publication.v2"
    && publication.schema_version !== "task_evaluation_run_publication.v3"
  ) return "denied";
  if (!LEGACY_ARTIFACT_ID.test(artifactId)) return "denied";
  const delivery = publication.result_delivery;
  return delivery?.status === "ready"
    && Array.isArray(delivery.artifacts)
    && delivery.artifacts.some((row: Record<string, any>) => row.artifact_id === artifactId)
    ? "inline_delivery"
    : "denied";
}

export function taskEvaluationResultArtifactIdIsSafe(artifactId: string) {
  return SAFE_ARTIFACT_ID.test(artifactId);
}
