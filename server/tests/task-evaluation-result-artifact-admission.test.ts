import { describe, expect, it } from "vitest";

import { taskEvaluationResultArtifactAdmission } from "../utils/taskEvaluationResultArtifactAdmission";

describe("Task Evaluation Result artifact admission", () => {
  it.each(["task_evaluation_run_publication.v2", "task_evaluation_run_publication.v3"])(
    "preserves the %s inline allowlist",
    (schemaVersion) => {
      const admitted = "a".repeat(32);
      const publication = {
        schema_version: schemaVersion,
        result_delivery: {
          status: "ready",
          artifacts: [{ artifact_id: admitted }],
        },
      };
      expect(taskEvaluationResultArtifactAdmission(publication, admitted))
        .toBe("inline_delivery");
      expect(taskEvaluationResultArtifactAdmission(publication, "b".repeat(32)))
        .toBe("denied");
      expect(taskEvaluationResultArtifactAdmission(publication, "friendly-v4-id"))
        .toBe("denied");
    },
  );

  it("routes safe v4 IDs to the per-run Pipeline registry and rejects path syntax", () => {
    const publication = { schema_version: "task_evaluation_run_publication.v4" };
    expect(taskEvaluationResultArtifactAdmission(publication, "observation-frame"))
      .toBe("pipeline_run_registry");
    expect(taskEvaluationResultArtifactAdmission(publication, "../observation-frame"))
      .toBe("denied");
    expect(taskEvaluationResultArtifactAdmission(publication, "frame/id"))
      .toBe("denied");
  });
});
