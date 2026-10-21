// @vitest-environment node
import { describe, expect, it } from "vitest";
import fixtures from "./fixtures/pipeline-managed-job-publications.json";
import { parseVerifiedTaskEvaluationRunPublication } from "../utils/taskEvaluationRunContract";
import { evaluationReadyPolicyRunSetupSchema } from "../utils/evaluationReadyRunContract";
import { projectManagedJobEvidence } from "../utils/jobManagedEvaluation";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";

describe("actual Python managed-run producer compatibility", () => {
  it("accepts the actual producer's native float identities without changing them", () => {
    for (const publication of [fixtures.v1, fixtures.v3]) {
      expect(canonicalArtifactDigest(publication.evidence_plan, "plan_digest")).not.toBe(publication.evidence_plan.plan_digest);
      expect(parseVerifiedTaskEvaluationRunPublication(publication)).toMatchObject({ ok: true });
      const tampered = structuredClone(publication);
      tampered.decision_envelope.decision_question = "A changed question";
      expect(parseVerifiedTaskEvaluationRunPublication(tampered)).toMatchObject({ ok: false, blockers: ["decision_envelope_digest_mismatch"] });
      const mismatchedBytes = structuredClone(publication);
      mismatchedBytes.producer_canonical_json.evidence_plan = "{}";
      expect(parseVerifiedTaskEvaluationRunPublication(mismatchedBytes)).toMatchObject({ ok: false, blockers: ["evidence_plan_digest_mismatch"] });
    }
  });

  it("preserves the real published eight-family protocol rather than relabeling cousins", () => {
    const setup = evaluationReadyPolicyRunSetupSchema.parse(fixtures.managed_setup);
    expect(setup.presets[0].family_counts).toHaveProperty("admitted_object_material_cousin", 1);
    expect(setup.presets[0].family_counts).not.toHaveProperty("held_out");
    expect(setup.presets[0].cells?.find(cell => cell.family === "held_out_composition")?.partition).toBe("held_out");
  });

  it("projects the exact accepted abstention to its job without a recommendation or pass", () => {
    const value = fixtures.v3;
    const briefDigest = `sha256:${"a".repeat(64)}`, taskContext = `sha256:${"b".repeat(64)}`;
    const run = { run_id: value.run_id, state: "abstained", source_launch_id: value.policy_run_result.source_launch_id,
      offering_digest: value.policy_run_result.offering_digest, configuration_digest: value.policy_run_result.configuration_digest,
      delivery_digest: value.result_delivery.delivery_digest, result_record_id: "software-result",
      job_evidence_binding: { job_id: "job-one", brief_digest: briefDigest }, job_task_context_digest: taskContext };
    const projected = projectManagedJobEvidence(value.run_id, run, { record_id: "software-result", publication: value },
      "job-one", briefDigest, taskContext)!;
    expect(projected.state).toBe("abstained");
    expect(projected.resultDigest).toBe(value.policy_run_result.projection_digest);
    expect(projected.summary).toContain("abstention");
    expect(projected.limitations.join(" ")).toContain("does not prove physical success");
    expect(fixtures.provenance).toMatchObject({ scope: "development_only", provider_execution: false, physical_evidence: false });
  });
});
