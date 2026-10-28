// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assertManagedOfferingForJob, managedJobTask, projectManagedJobEvidence } from "../utils/jobManagedEvaluation";
import { jobEvidenceTaskInventoryDigest, scientificBriefDigest } from "../utils/jobEvidenceContract";
import { projectWebsiteCaptureRights, projectWebsiteTaskContext } from "../utils/websiteTaskContext";
import { evaluationReadyRunInputSchema, resolvedPolicyRunSelectionSchema } from "../utils/evaluationReadyRunContract";
import type { ConfiguredSceneOffering } from "../utils/configuredSceneOfferingContract";
import type { SiteTaskBriefRecord } from "../utils/siteTaskBrief";
import policyCanaryPublication from "./fixtures/pipeline-policy-canary-publication.v4.json";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import sourceExamples from "./fixtures/job-evidence-producer-examples.v1.json";

function fixture() {
  const brief = { requestId: "job-one", summary: "Move the rigid part to its tray", confirmedAtIso: "2026-10-20T12:00:00Z",
    operatorAnswers: {}, unresolved: [] } as unknown as SiteTaskBriefRecord;
  const record: Record<string, any> = { request: { buyerType: "site_operator", consent_attestation: {
    granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-10-20T11:00:00Z" } } };
  const context = projectWebsiteTaskContext(brief, projectWebsiteCaptureRights(record));
  record.website_scene_sponsorship = { task_context_digest: context.context_digest,
    owner: { organization_id: "blueprint-operations" } };
  const binding = { job_id: brief.requestId, brief_digest: scientificBriefDigest(brief as unknown as Record<string, unknown>) };
  const offering = { team_namespace: "blueprint-operations", task: { identity: { id: `website-${context.context_digest.slice(7, 27)}` } } } as ConfiguredSceneOffering;
  return { brief, record, binding, offering };
}

function nativeFixture(sessionId = "source-session-one") {
  const value = fixture();
  const producer = sourceExamples.native_request;
  const source = { schema_version: "job_evidence_source_binding.v1", job_id: value.binding.job_id,
    capture_session_id: sessionId, intake_id: producer.intake_id,
    source_capture_digest: producer.testbed.source_capture_bundles[0].digest,
    brief_digest: value.binding.brief_digest, task_inventory_digest: jobEvidenceTaskInventoryDigest(value.brief, null),
    command_request_id: "approved-command-one", approved_task_digest: producer.approved_task_digest };
  value.record.job_evidence_source = source;
  const sourceSession = { session_id: sessionId, request: { intake_id: producer.intake_id },
    job_evidence_source_binding: source, approved_task_definition: { approved_task_digest: producer.approved_task_digest },
    pipeline_site_task_testbed: { job_id: value.binding.job_id, brief_digest: value.binding.brief_digest,
      approved_task_digest: producer.approved_task_digest, testbed: producer.testbed,
      decision_evidence_request: producer.decision_evidence_request, testbed_canonical_json: producer.testbed_canonical_json,
      decision_request_canonical_json: producer.decision_request_canonical_json,
      compiled_card_canonical_json: producer.compiled_card_canonical_json } };
  return { ...value, sourceSession };
}

describe("job to managed execution binding", () => {
  it("binds only the real agreed task and separates buying budget from technical scope", () => {
    const { brief, record, binding, offering } = fixture();
    const scope = managedJobTask({ brief, record, binding });
    expect(() => assertManagedOfferingForJob(scope, offering)).not.toThrow();
    record.job_marketplace = { requirements: { installationBudget: "$12,000" } };
    expect(managedJobTask({ brief, record, binding })).toEqual(scope);
    expect(() => assertManagedOfferingForJob(scope, { ...offering, team_namespace: "another-site" })).toThrow("job_evaluation_source_mismatch");
    expect(() => assertManagedOfferingForJob(scope, { ...offering, task: { ...offering.task, identity: { id: "another-task", version: "1" } } })).toThrow("job_evaluation_source_mismatch");
  });

  it("refuses changed task truth or withdrawn recording permission without fabricating a run", () => {
    const { brief, record, binding } = fixture();
    expect(() => managedJobTask({ brief: { ...brief, summary: "Move a different part" }, record, binding })).toThrow("job_brief_changed");
    record.request.consent_attestation.revoked_at_iso = "2026-10-20T13:00:00Z";
    expect(() => managedJobTask({ brief, record, binding })).toThrow("job_capture_processing_not_authorized");
    expect(() => managedJobTask({ brief, record: { request: { buyerType: "site_operator" } }, binding })).toThrow();
  });

  it("keeps the commercial association outside the immutable scientific selection schema", () => {
    const { binding } = fixture();
    const input = { schema_version: "task_evaluation_policy_run_selection.v1", run_id: "run-one",
      offering_digest: `sha256:${"a".repeat(64)}`, preset_id: "quick_10", job_evidence_binding: binding };
    expect(evaluationReadyRunInputSchema.parse(input).job_evidence_binding).toEqual(binding);
    expect(resolvedPolicyRunSelectionSchema.safeParse({ ...input, source_launch_id: "source-one", setup_digest: `sha256:${"b".repeat(64)}` }).success).toBe(false);
    const { job_evidence_binding: _job, ...selection } = input;
    expect(resolvedPolicyRunSelectionSchema.safeParse({ ...selection, source_launch_id: "source-one", setup_digest: `sha256:${"b".repeat(64)}` }).success).toBe(true);
  });

  it("binds actual producer testbed/source identities and leaves an old source historical without inventing scene compatibility", () => {
    const original = nativeFixture();
    const scope = managedJobTask(original);
    expect(scope.sourceCaptureSessionId).toBe(original.sourceSession.session_id);
    expect(scope.taskIds).toEqual([]);
    expect(() => assertManagedOfferingForJob(scope, original.offering)).toThrow("job_evaluation_source_mismatch");
    original.record.job_marketplace = { requirements: { installationBudget: "A different quote budget" } };
    expect(managedJobTask(original).sourceFingerprint).toBe(scope.sourceFingerprint);
    original.record.job_evidence_source = { ...original.record.job_evidence_source, command_request_id: "reconfirmed-command-two", recorded_at_iso: "later" };
    original.sourceSession.job_evidence_source_binding = { ...original.record.job_evidence_source };
    expect(managedJobTask(original).sourceFingerprint).toBe(scope.sourceFingerprint);

    const changed = nativeFixture("source-session-two");
    const changedScope = managedJobTask(changed);
    expect(changedScope.sourceFingerprint).not.toBe(scope.sourceFingerprint);
    const run = { run_id: "retained-run", job_evidence_binding: original.binding,
      job_task_context_digest: scope.taskContextDigest, job_source_fingerprint: scope.sourceFingerprint, state: "results_ready" };
    expect(projectManagedJobEvidence("retained-run", run, null, original.binding.job_id, original.binding.brief_digest,
      scope.taskContextDigest, scope.sourceFingerprint)?.current).toBe(true);
    expect(projectManagedJobEvidence("retained-run", run, null, changed.binding.job_id, changed.binding.brief_digest,
      changedScope.taskContextDigest, changedScope.sourceFingerprint)?.current).toBe(false);
    expect(projectManagedJobEvidence("retained-run", { ...run, job_source_fingerprint: undefined }, null,
      original.binding.job_id, original.binding.brief_digest, scope.taskContextDigest, scope.sourceFingerprint)?.current).toBe(false);
  });

  it("refuses current source lifecycle revocation, missing source, and changed retained testbed before new admission", () => {
    const original = nativeFixture();
    expect(() => managedJobTask({ ...original, sourceSession: null })).toThrow("job_evaluation_source_unavailable");
    for (const revoked of [{ capture_access: { future_processing_allowed: false } }, { completed_capture_lifecycle: {} },
      { status: "revocation_in_progress" }]) {
      expect(() => managedJobTask({ ...original, sourceSession: { ...original.sourceSession, ...revoked } })).toThrow("job_capture_processing_not_authorized");
    }
    expect(() => managedJobTask({ ...original, sourceSession: { ...original.sourceSession,
      pipeline_site_task_testbed: { ...original.sourceSession.pipeline_site_task_testbed, testbed_canonical_json: "{}" } } })).toThrow("job_evaluation_source_changed");
    const wrongDigest = { ...original.record.job_evidence_source, source_capture_digest: `sha256:${"f".repeat(64)}` };
    expect(() => managedJobTask({ ...original, record: { ...original.record, job_evidence_source: wrongDigest },
      sourceSession: { ...original.sourceSession, job_evidence_source_binding: wrongDigest } })).toThrow("job_evaluation_source_changed");
  });

  it("shows accepted diagnostic evidence with its exact ceiling and keeps stale scope historical", () => {
    const { binding } = fixture();
    const publication = structuredClone(policyCanaryPublication);
    publication.result_delivery.delivery_digest = crossRuntimeArtifactDigest(publication.result_delivery, "delivery_digest");
    publication.policy_canary_result.result_delivery_digest = publication.result_delivery.delivery_digest;
    publication.policy_canary_result.projection_digest = crossRuntimeArtifactDigest(publication.policy_canary_result, "projection_digest");
    const taskContext = `sha256:${"c".repeat(64)}`;
    const sourceFingerprint = `sha256:${"e".repeat(64)}`;
    const run = { run_id: publication.run_id, state: "results_ready", job_evidence_binding: binding,
      job_task_context_digest: taskContext, result_record_id: "result-one", source_launch_id: publication.capture_session_id,
      job_source_fingerprint: sourceFingerprint,
      configuration_digest: publication.configuration_digest, delivery_digest: publication.result_delivery.delivery_digest };
    const result = { record_id: "result-one", publication };
    const projected = projectManagedJobEvidence(publication.run_id, run, result, "job-one", binding.brief_digest, taskContext, sourceFingerprint)!;
    expect(projected.current).toBe(true);
    expect(projected.resultDigest).toBe(publication.policy_canary_result.projection_digest);
    expect(projected.summary).toContain("No winner or qualified evaluation");
    expect(projected.limitations.join(" ")).toContain("not a passed evaluation");
    const historical = projectManagedJobEvidence(publication.run_id, run, result, "job-one", binding.brief_digest, taskContext, null)!;
    expect(historical.current).toBe(false);
    expect(historical.resultDigest).toBe(projected.resultDigest);
    expect(projectManagedJobEvidence(publication.run_id, run, result, "another-job", binding.brief_digest, taskContext)).toBeNull();
    expect(projectManagedJobEvidence(publication.run_id, run, result, "job-one", binding.brief_digest, null)?.current).toBe(false);
    expect(projectManagedJobEvidence(publication.run_id, { ...run, configuration_digest: `sha256:${"d".repeat(64)}` }, result,
      "job-one", binding.brief_digest, taskContext)?.resultDigest).toBeNull();
  });
});

it("makes an earlier recording inapplicable when the job selects a new child capture", () => {
  const original = fixture();
  expect(() => managedJobTask(original)).not.toThrow();
  original.record.active_capture_id = "supplement-new-recording";
  expect(() => managedJobTask(original)).toThrow("job_evaluation_source_changed");
  const native = nativeFixture();
  native.record.active_capture_id = "replacement-session";
  expect(() => managedJobTask(native)).toThrow("job_evaluation_source_changed");
});
