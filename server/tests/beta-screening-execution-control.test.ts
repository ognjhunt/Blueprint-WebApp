// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "../utils/crossRuntimeCanonical";
import { ingestBetaPolicyScreening, observeBetaScreeningExecutionControl, parseBetaScreeningExecutionControlRequest,
  type BetaScreeningExecutionControlRequest } from "../utils/betaPolicyScreeningIngest";
import { screeningFixture, screeningSha, sealScreening } from "./fixtures/beta-policy-screening";
import { projectWebsiteCaptureRights, projectWebsiteTaskContext } from "../utils/websiteTaskContext";
import { loadManagedJobEvidence, assertManagedJobEvidenceReference } from "../utils/jobManagedEvaluation";
import { scientificBriefDigest } from "../utils/jobEvidenceContract";

const store = vi.hoisted(() => ({ state: { docs: new Map<string, any>() }, fail: false }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { createFakeFirestore } = await import("./helpers/fake-firestore");
  const database = createFakeFirestore(store.state);
  return { dbAdmin: { ...database, runTransaction: async (fn: any) => {
    if (store.fail) throw new Error("mock_storage_unreachable");
    return database.runTransaction(fn);
  } } };
});
const NOW = Date.parse("2026-10-28T12:00:00Z"), EXPIRY = NOW + 3_600_000;
const row = (path: string) => store.state.docs.get(path);
function resealIntake(intake: any) {
  intake.request_digest = crossRuntimeDigest(intake.request);
  intake.receipt.request_digest = intake.request_digest;
  intake.receipt.receipt_digest = crossRuntimeArtifactDigest(intake.receipt, "receipt_digest");
  intake.pipeline_status.request_digest = intake.request_digest;
  intake.pipeline_status.status_digest = crossRuntimeArtifactDigest(intake.pipeline_status, "status_digest");
}
async function seed(jobId = "job-one", campaignId = "campaign-one", publicationVersion: "v1" | "v2" = "v2") {
  const fixture = screeningFixture();
  fixture.brief.requestId = jobId;
  const context = projectWebsiteTaskContext(fixture.brief, projectWebsiteCaptureRights(fixture.job));
  fixture.job.website_scene_sponsorship.capture_id = context.capture_id;
  fixture.job.website_scene_sponsorship.task_context_digest = context.context_digest;
  const intake: any = fixture.intake;
  intake.website_request_id = jobId;
  intake.source_session_id = context.capture_id;
  intake.request.submission_id = context.capture_id;
  intake.request.task.task_id = `website-${context.context_digest.slice(7, 27)}`;
  intake.request.execution = { expires_at_epoch: EXPIRY / 1000 };
  intake.receipt.intent_id = `scene-${jobId}`;
  intake.pipeline_status.intent_id = intake.receipt.intent_id;
  resealIntake(intake);
  const publication = sealScreening({ ...fixture.publication,
    ...(publicationVersion === "v1" ? { schema_version: "beta_policy_screening_publication.v1" as const,
      purpose: "screening" as const, claim_ceiling: "diagnostic_policy_execution" as const, recommendation_eligible: false as const } : {}),
    campaign_id: campaignId, site_id: context.scene_id,
    source: { ...fixture.publication.source, scene_intent_id: intake.receipt.intent_id, capture_id: context.capture_id,
      task_id: intake.request.task.task_id, task_context_digest: context.context_digest } });
  store.state.docs.set(`inboundRequests/${jobId}`, fixture.job);
  store.state.docs.set(`siteTaskBriefs/${jobId}`, fixture.brief);
  store.state.docs.set(`taskEvaluationSceneIntakes/intake-${jobId}`, intake);
  await ingestBetaPolicyScreening(publication);
  const request: BetaScreeningExecutionControlRequest = {
    schema_version: "blueprint.beta_policy_screening_execution_control_request.v1",
    campaign_id: campaignId, site_id: publication.site_id, plan_digest: publication.plan_digest,
    candidate_id: publication.candidates[0].candidate_id, configuration_digest: publication.candidates[0].configuration_digest,
    attempt_id: `attempt-${campaignId}`, invocation_id: crossRuntimeDigest({ invocation: campaignId }),
    prepared_digest: screeningSha("1"), authority_digest: screeningSha("2"), resource_name: `blueprint-${campaignId}`,
    source: publication.source,
  };
  return { request, publication, intake };
}
let fixture: Awaited<ReturnType<typeof seed>>;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(NOW);
  store.state.docs.clear(); store.fail = false; fixture = await seed();
});
afterEach(() => { vi.useRealTimers(); store.fail = false; });
const controls = () => row("taskEvaluationPolicyRuns/campaign-one").screening_execution_controls;

it.each(["v1", "v2"] as const)("joins execution control to the same exact source for publication %s", async version => {
  store.state.docs.clear();
  const seeded = await seed("job-one", "campaign-one", version);
  expect(seeded.publication.schema_version).toBe(`beta_policy_screening_publication.${version}`);
  const control = await observeBetaScreeningExecutionControl(seeded.request);
  expect(control).toMatchObject({ status: "current", new_execution_authorized: false, binding: { source: seeded.publication.source } });
  const changed = { ...seeded.request, source: { ...seeded.request.source, task_context_digest: screeningSha("9") } };
  await expect(observeBetaScreeningExecutionControl(changed)).rejects.toThrow("screening_control_identity_conflict");
});

it("observes the exact existing attempt with only one control map write and no execution or budget grant", async () => {
  const before = structuredClone([...store.state.docs]), control = await observeBetaScreeningExecutionControl(fixture.request);
  const { schema_version, ...binding } = fixture.request;
  expect(control).toMatchObject({ binding, binding_digest: crossRuntimeDigest(binding), status: "current", revision: 1,
    cancellation_requested: false, stop_reason: null, execution_deadline_at_ms: EXPIRY,
    new_execution_authorized: false, read_only_closeout_allowed: true, applicability: "current",
    observed_at_iso: new Date(NOW).toISOString(), next_check_at_ms: NOW + 60_000 });
  expect(control.control_digest).toBe(crossRuntimeArtifactDigest(control, "control_digest"));
  expect(Object.keys(controls())).toEqual([control.binding_digest.slice(7)]);
  expect([...store.state.docs.keys()]).toEqual(before.map(([key]) => key));
  for (const [key, value] of before) {
    const actual = structuredClone(row(key));
    if (key === "taskEvaluationPolicyRuns/campaign-one") delete actual.screening_execution_controls;
    expect(actual).toEqual(value);
  }
});

describe("immutable source and invocation bindings", () => {
  it.each(["campaign_id", "site_id", "plan_digest", "candidate_id", "configuration_digest"] as const)("refuses changed %s", async key => {
    const changed = { ...fixture.request, [key]: key.endsWith("digest") ? screeningSha("9") : "other" };
    await expect(observeBetaScreeningExecutionControl(changed)).rejects.toThrow("screening_control_identity_conflict");
    expect(controls()).toBeUndefined();
  });
  it.each(["scene_intent_id", "scene_intent_digest", "capture_id", "task_id", "task_context_digest", "scene_revision_digest"] as const)("joins source %s", async key => {
    const changed = { ...fixture.request, source: { ...fixture.request.source,
      [key]: key.endsWith("digest") ? screeningSha("9") : "other" } };
    await expect(observeBetaScreeningExecutionControl(changed)).rejects.toThrow("screening_control_identity_conflict");
    expect(controls()).toBeUndefined();
  });
  it.each(["prepared_digest", "authority_digest", "invocation_id", "attempt_id", "resource_name"] as const)("cannot rebind an existing attempt's %s", async key => {
    await observeBetaScreeningExecutionControl(fixture.request);
    const saved = structuredClone(controls());
    await expect(observeBetaScreeningExecutionControl({ ...fixture.request,
      [key]: key.endsWith("digest") || key === "invocation_id" ? screeningSha("9") : "changed" }))
      .rejects.toThrow("screening_control_identity_conflict");
    expect(controls()).toEqual(saved);
  });
  it("rejects a retained control whose binding or digest has been corrupted", async () => {
    const control = await observeBetaScreeningExecutionControl(fixture.request);
    controls()[control.binding_digest.slice(7)].binding.authority_digest = screeningSha("9");
    await expect(observeBetaScreeningExecutionControl(fixture.request)).rejects.toThrow("screening_control_record_unavailable");
  });
  it("serializes simultaneous exact reads without rebinding or creating another run", async () => {
    const [first, second] = await Promise.all([observeBetaScreeningExecutionControl(fixture.request), observeBetaScreeningExecutionControl(fixture.request)]);
    expect([first.revision, second.revision]).toEqual([1, 2]);
    expect(Object.keys(controls())).toHaveLength(1);
  });
});

it("only shortens the original, caller and previously observed deadlines", async () => {
  expect((await observeBetaScreeningExecutionControl({ ...fixture.request, execution_deadline_at_ms: EXPIRY + 1_000_000 })).execution_deadline_at_ms).toBe(EXPIRY);
  const shortened = NOW + 120_000;
  expect((await observeBetaScreeningExecutionControl({ ...fixture.request, execution_deadline_at_ms: shortened })).execution_deadline_at_ms).toBe(shortened);
  fixture.intake.request.execution.expires_at_epoch += 10_000; resealIntake(fixture.intake);
  expect((await observeBetaScreeningExecutionControl(fixture.request)).execution_deadline_at_ms).toBe(shortened);
  fixture.intake.request.execution.expires_at_epoch = (NOW + 90_000) / 1000; resealIntake(fixture.intake);
  expect((await observeBetaScreeningExecutionControl(fixture.request)).execution_deadline_at_ms).toBe(NOW + 90_000);
});

it.each([undefined, null, "2026-10-28", NaN, Infinity, 0, -1, Number.MAX_SAFE_INTEGER])("missing/invalid real expiry %s never grants current authority", async expiry => {
  fixture.intake.request.execution.expires_at_epoch = expiry;
  await expect(observeBetaScreeningExecutionControl(fixture.request)).rejects.toThrow("screening_control_authority_unavailable");
  expect(controls()).toBeUndefined();
});

it("expires mid-session and returns the same absorbing stop after restart and source recovery", async () => {
  await observeBetaScreeningExecutionControl(fixture.request);
  vi.setSystemTime(EXPIRY);
  const stopped = await observeBetaScreeningExecutionControl(fixture.request);
  expect(stopped).toMatchObject({ status: "stopped", stop_reason: "screening_authority_expired", applicability: "historical_only" });
  // A restart does not need to reauthorize a revoked/unavailable source to close out.
  store.state.docs.delete("taskEvaluationSceneIntakes/intake-job-one");
  store.state.docs.delete("inboundRequests/job-one");
  expect(await observeBetaScreeningExecutionControl(fixture.request)).toEqual(stopped);
});

describe("current source refusals stop only the existing owned attempt", () => {
  it.each([
    ["consent revoked", () => { row("inboundRequests/job-one").consent_revoked = true; }, "job_capture_processing_not_authorized"],
    ["consent withdrawn", () => { row("inboundRequests/job-one").request.consent_attestation.granted = false; }, "job_capture_processing_not_authorized"],
    ["durable withdrawal", () => { row("inboundRequests/job-one").capture_withdrawal = { state: "uploads_stopped_cleanup_pending" }; }, "job_capture_processing_not_authorized"],
    ["capture revoked", () => { store.state.docs.set("captureUploadSessions/walkthrough-job-one", { capture_access: { future_processing_allowed: false } }); }, "job_capture_processing_not_authorized"],
    ["brief changed", () => { row("siteTaskBriefs/job-one").summary = "Different job"; }, "job_brief_changed"],
    ["capture replaced", () => { row("inboundRequests/job-one").website_scene_sponsorship.capture_id = "different-capture"; }, "job_evaluation_source_changed"],
    ["scene revoked", () => { fixture.intake.revocation_requested = true; }, "screening_scene_authority_revoked"],
    ["scene closeout", () => { fixture.intake.state = "closeout_pending"; }, "screening_scene_authority_revoked"],
    ["scene bytes changed", () => { fixture.intake.request.task.task_id = "changed"; }, "screening_scene_source_mismatch"],
    ["scene revision changed", () => { fixture.intake.pipeline_status.result_reference.digest = screeningSha("9"); resealIntake(fixture.intake); }, "screening_scene_source_mismatch"],
    ["run cancellation", () => { row("taskEvaluationPolicyRuns/campaign-one").cancellationRequested = true; }, "screening_run_cancelled"],
  ] as const)("%s becomes an absorbing historical-only stop", async (_name, mutate, reason) => {
    await observeBetaScreeningExecutionControl(fixture.request); mutate();
    const stopped = await observeBetaScreeningExecutionControl(fixture.request);
    expect(stopped).toMatchObject({ status: "stopped", cancellation_requested: true, stop_reason: reason,
      applicability: "historical_only", read_only_closeout_allowed: true, new_execution_authorized: false });
    row("inboundRequests/job-one").consent_revoked = false;
    fixture.intake.revocation_requested = false;
    expect(await observeBetaScreeningExecutionControl(fixture.request)).toEqual(stopped);
  });
  it("honors a durable signed owner closure without replacing consent or stored evidence", async () => {
    await observeBetaScreeningExecutionControl(fixture.request);
    const closure = { schema_version: "website_run_closure.v1", request_id: "job-one", capture_id: fixture.request.source.capture_id,
      decision: "conservative_abstention", actor: "signed_owner_link", source_identity_digest: screeningSha("7"),
      closed_at_iso: new Date(NOW).toISOString(), new_execution_authorized: false, explicit_resume_required: true, physical_validation: false };
    row("inboundRequests/job-one").website_run_closures = { [closure.capture_id]: { ...closure, closure_digest: crossRuntimeDigest(closure) } };
    expect((await observeBetaScreeningExecutionControl(fixture.request)).stop_reason).toBe("website_run_closed_by_owner");
    expect(row("inboundRequests/job-one").request.consent_attestation.granted).toBe(true);
  });
  it("keeps another site's run current while this site's authority is revoked", async () => {
    const other = await seed("job-two", "campaign-two");
    await observeBetaScreeningExecutionControl(fixture.request);
    row("inboundRequests/job-one").consent_revoked = true;
    expect((await observeBetaScreeningExecutionControl(fixture.request)).status).toBe("stopped");
    expect((await observeBetaScreeningExecutionControl(other.request)).status).toBe("current");
  });
});

it("does not turn an unknown storage failure or malformed owner closure into a fresh current decision", async () => {
  store.fail = true;
  await expect(observeBetaScreeningExecutionControl(fixture.request)).rejects.toThrow("mock_storage_unreachable");
  store.fail = false;
  expect(controls()).toBeUndefined();
  row("inboundRequests/job-one").website_run_closures = { [fixture.request.source.capture_id]: {} };
  await expect(observeBetaScreeningExecutionControl(fixture.request)).rejects.toThrow("website_run_closure_invalid");
  expect(controls()).toBeUndefined();
});

it("preserves retained stops and run cancellation across later signed publication ingestion", async () => {
  row("taskEvaluationPolicyRuns/campaign-one").cancellationRequested = true;
  const stopped = await observeBetaScreeningExecutionControl(fixture.request);
  const saved = structuredClone(controls());
  const next = sealScreening({ ...fixture.publication, revision: 2, status: "running",
    candidates: fixture.publication.candidates.map((candidate, index) => index ? candidate : { ...candidate, status: "running" }) });
  await ingestBetaPolicyScreening(next);
  expect(controls()).toEqual(saved);
  expect(row("taskEvaluationPolicyRuns/campaign-one").cancellationRequested).toBe(true);
  expect(await observeBetaScreeningExecutionControl(fixture.request)).toEqual(stopped);
});

it.each(["cancelled", "closed"])("late publication cannot reopen campaign-level %s authority for another existing attempt", async state => {
  const other = { ...fixture.request, candidate_id: fixture.publication.candidates[1].candidate_id,
    attempt_id: "second-attempt", invocation_id: screeningSha("8"), prepared_digest: screeningSha("7"),
    authority_digest: screeningSha("6"), resource_name: "second-owned-resource" };
  await observeBetaScreeningExecutionControl(fixture.request); await observeBetaScreeningExecutionControl(other);
  row("taskEvaluationPolicyRuns/campaign-one").state = state;
  expect((await observeBetaScreeningExecutionControl(fixture.request)).status).toBe("stopped");
  const next = sealScreening({ ...fixture.publication, revision: 2, status: "running",
    candidates: fixture.publication.candidates.map((candidate, index) => index ? candidate : { ...candidate, status: "running" }) });
  await ingestBetaPolicyScreening(next);
  expect(row("taskEvaluationPolicyRuns/campaign-one").state).toBe(state);
  expect(row("taskEvaluationPolicyRuns/campaign-one").cancellationRequested).toBe(true);
  expect((await observeBetaScreeningExecutionControl(other)).status).toBe("stopped");
});

it.each([false, true])("retains late owner-closed evidence historically in actual readback (prior control observation=%s)", async observed => {
  await observeBetaScreeningExecutionControl(fixture.request);
  const closure = { schema_version: "website_run_closure.v1", request_id: "job-one", capture_id: fixture.request.source.capture_id,
    decision: "conservative_abstention", actor: "signed_owner_link", source_identity_digest: screeningSha("7"),
    closed_at_iso: new Date(NOW).toISOString(), new_execution_authorized: false, explicit_resume_required: true, physical_validation: false };
  row("inboundRequests/job-one").website_run_closures = { [closure.capture_id]: { ...closure, closure_digest: crossRuntimeDigest(closure) } };
  if (observed) expect((await observeBetaScreeningExecutionControl(fixture.request)).stop_reason).toBe("website_run_closed_by_owner");
  const next = sealScreening({ ...fixture.publication, status: "queued", revision: 2,
    candidates: fixture.publication.candidates.map((candidate, index) => index ? candidate : { ...candidate,
      status: "completed", episodes_scored: 3, episodes_succeeded: 2, episodes_failed: 1,
      success_rate: 2 / 3, session_result_digest: screeningSha("8") }) });
  await ingestBetaPolicyScreening(next);
  const evidence = await loadManagedJobEvidence("job-one", scientificBriefDigest(row("siteTaskBriefs/job-one")));
  expect(evidence[0].current).toBe(false);
  expect(evidence[0].screening?.candidates[0].state).toBe("completed");
  expect(evidence[0].screening?.candidates[0].scored).toBe(3);
  expect(row("taskEvaluationPolicyRuns/campaign-one").publication_digest).toBe(next.publication_digest);
  expect((await observeBetaScreeningExecutionControl(fixture.request)).status).toBe("stopped");
});

it.each([false, true])("reads current owner closure before any monitor observation (publication replay=%s)", async replay => {
  const closure = { schema_version: "website_run_closure.v1", request_id: "job-one", capture_id: fixture.request.source.capture_id,
    decision: "conservative_abstention", actor: "signed_owner_link", source_identity_digest: screeningSha("7"),
    closed_at_iso: new Date(NOW).toISOString(), new_execution_authorized: false, explicit_resume_required: true, physical_validation: false };
  row("inboundRequests/job-one").website_run_closures = { [closure.capture_id]: { ...closure, closure_digest: crossRuntimeDigest(closure) } };
  const readback = () => loadManagedJobEvidence("job-one", scientificBriefDigest(row("siteTaskBriefs/job-one")));
  expect((await readback())[0].current).toBe(false);
  if (replay) {
    expect((await ingestBetaPolicyScreening(fixture.publication)).status).toBe("replayed");
    expect(row("taskEvaluationPolicyRuns/campaign-one").state).toBe("closed");
    expect(row("taskEvaluationPolicyRuns/campaign-one").cancellationRequested).toBe(true);
  }
  expect((await readback())[0].current).toBe(false);
  expect(row("taskEvaluationPolicyRuns/campaign-one").publication_digest).toBe(fixture.publication.publication_digest);
  expect(controls()).toBeUndefined();
});

it.each(["owner_closure", "scene_revocation", "scene_revision"])("current evidence references share the actual readback source join (%s)", async change => {
  const completed = sealScreening({ ...fixture.publication, status: "completed", revision: 2,
    candidates: fixture.publication.candidates.map(candidate => ({ ...candidate, status: "completed", episodes_scored: 3,
      episodes_succeeded: 2, episodes_failed: 1, success_rate: 2 / 3, session_result_digest: screeningSha("8") })) });
  await ingestBetaPolicyScreening(completed);
  const briefDigest = scientificBriefDigest(row("siteTaskBriefs/job-one"));
  const reference = { runId: "campaign-one", resultDigest: completed.publication_digest };
  expect((await assertManagedJobEvidenceReference("job-one", briefDigest, reference)).current).toBe(true);
  const scientificBytes = JSON.stringify(row(`captureTaskEvaluationRuns/${row("taskEvaluationPolicyRuns/campaign-one").result_record_id}`));
  if (change === "owner_closure") {
    const closure = { schema_version: "website_run_closure.v1", request_id: "job-one", capture_id: fixture.request.source.capture_id,
      decision: "conservative_abstention", actor: "signed_owner_link", source_identity_digest: screeningSha("7"),
      closed_at_iso: new Date(NOW).toISOString(), new_execution_authorized: false, explicit_resume_required: true, physical_validation: false };
    row("inboundRequests/job-one").website_run_closures = { [closure.capture_id]: { ...closure, closure_digest: crossRuntimeDigest(closure) } };
  } else if (change === "scene_revocation") fixture.intake.revocation_requested = true;
  else {
    fixture.intake.pipeline_status.result_reference.digest = screeningSha("9"); resealIntake(fixture.intake);
  }
  expect((await loadManagedJobEvidence("job-one", briefDigest))[0].current).toBe(false);
  await expect(assertManagedJobEvidenceReference("job-one", briefDigest, reference)).rejects.toThrow("job_managed_evidence_reference_unavailable_or_stale");
  expect(JSON.stringify(row(`captureTaskEvaluationRuns/${row("taskEvaluationPolicyRuns/campaign-one").result_record_id}`))).toBe(scientificBytes);
  expect(controls()).toBeUndefined();
});

it("never treats a completed candidate as permission to resume processing", async () => {
  const completed = sealScreening({ ...fixture.publication, status: "queued", revision: 2,
    candidates: fixture.publication.candidates.map((candidate, index) => index ? candidate : { ...candidate,
      status: "completed", episodes_scored: 3, episodes_succeeded: 2, episodes_failed: 1,
      success_rate: 2 / 3, session_result_digest: screeningSha("8") }) });
  await ingestBetaPolicyScreening(completed);
  expect((await observeBetaScreeningExecutionControl(fixture.request)).stop_reason).toBe("screening_candidate_closed");
});

it("rejects unscoped or unknown request fields and non-finite or unsafe caller deadlines", () => {
  expect(parseBetaScreeningExecutionControlRequest({ ...fixture.request, team_id: "injected" })).toBeNull();
  expect(parseBetaScreeningExecutionControlRequest({ ...fixture.request, source: { ...fixture.request.source, job_id: "other" } })).toBeNull();
  for (const deadline of [NaN, Infinity, 0, -1, Number.MAX_SAFE_INTEGER])
    expect(parseBetaScreeningExecutionControlRequest({ ...fixture.request, execution_deadline_at_ms: deadline })).toBeNull();
});
